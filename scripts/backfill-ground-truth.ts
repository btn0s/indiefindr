import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateAllEmbeddings, type GameForEmbedding } from "../src/lib/embeddings";
import groundTruth from "./ground-truth-realistic.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUniqueAppIds(): Promise<number[]> {
  const allPairs = Object.values(groundTruth.pairs).flat();
  const appIds = new Set<number>();
  
  for (const pair of allPairs) {
    appIds.add(pair.source);
    appIds.add(pair.target);
  }
  
  return Array.from(appIds).sort((a, b) => a - b);
}

async function checkEmbeddings(appid: number): Promise<string[]> {
  const { data } = await supabase
    .from("game_embeddings")
    .select("facet")
    .eq("appid", appid);
  
  return (data || []).map(row => row.facet);
}

async function getGameData(appid: number): Promise<GameForEmbedding | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, header_image, screenshots, short_description, long_description, steamspy_tags, raw")
    .eq("appid", appid)
    .single();
  
  if (!data) return null;
  
  return {
    appid: data.appid,
    title: data.title,
    header_image: data.header_image,
    screenshots: Array.isArray(data.screenshots) ? data.screenshots as string[] : [],
    short_description: data.short_description,
    long_description: data.long_description,
    steamspy_tags: data.steamspy_tags as Record<string, number> | null,
    raw: data.raw as GameForEmbedding["raw"],
  };
}

async function saveEmbeddings(embeddings: Awaited<ReturnType<typeof generateAllEmbeddings>>): Promise<void> {
  if (embeddings.length === 0) return;

  for (const embedding of embeddings) {
    const embeddingStr = `[${embedding.embedding.join(",")}]`;
    const { error } = await supabase.from("game_embeddings").upsert(
      {
        appid: embedding.appid,
        facet: embedding.facet,
        embedding: embeddingStr,
        embedding_model: embedding.embedding_model || "unknown",
        embedding_version: 1,
        source_type: embedding.source_type,
        source_data: embedding.source_data as any,
      },
      { onConflict: "appid,facet" }
    );

    if (error) {
      console.error(`  ✗ Failed to save ${embedding.facet}:`, error.message);
    }
  }
}

async function main() {
  console.log("=== Backfill Ground Truth Games ===\n");
  
  const appIds = await getUniqueAppIds();
  console.log(`Found ${appIds.length} unique games in ground truth dataset\n`);
  
  let processed = 0;
  let skipped = 0;
  let generated = 0;
  let notFound = 0;
  
  for (const appid of appIds) {
    const existingFacets = await checkEmbeddings(appid);
    
    if (existingFacets.length >= 3) {
      console.log(`✓ ${appid}: Already has ${existingFacets.length} facets (${existingFacets.join(", ")})`);
      skipped++;
      continue;
    }
    
    const game = await getGameData(appid);
    if (!game) {
      console.log(`✗ ${appid}: Not found in database`);
      notFound++;
      continue;
    }
    
    console.log(`⚙ ${appid}: ${game.title} - Generating embeddings...`);
    
    try {
      const embeddings = await generateAllEmbeddings(game);
      await saveEmbeddings(embeddings);
      console.log(`  ✓ Generated ${embeddings.length} embeddings`);
      generated++;
      processed++;
    } catch (error) {
      console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n=== Summary ===");
  console.log(`Total games: ${appIds.length}`);
  console.log(`Already complete: ${skipped}`);
  console.log(`Generated: ${generated}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Processed: ${processed}`);
}

main().catch(console.error);
