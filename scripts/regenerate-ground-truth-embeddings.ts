import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateAllEmbeddings, type GameWithIgdb } from "../src/lib/embeddings";
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

async function getGameData(appid: number): Promise<GameWithIgdb | null> {
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
    raw: data.raw as GameWithIgdb["raw"],
  };
}

async function deleteExistingEmbeddings(appid: number, facets: string[]): Promise<void> {
  const { error } = await supabase
    .from("game_embeddings")
    .delete()
    .eq("appid", appid)
    .in("facet", facets);
  
  if (error) {
    console.error(`Failed to delete embeddings for ${appid}:`, error);
  }
}

async function saveEmbeddings(embeddings: Array<{ appid: number; facet: string; embedding: number[]; source_type: string; source_data?: Record<string, unknown>; embedding_model?: string }>): Promise<void> {
  for (const emb of embeddings) {
    const { error } = await supabase
      .from("game_embeddings")
      .upsert({
        appid: emb.appid,
        facet: emb.facet,
        embedding: JSON.stringify(emb.embedding),
        embedding_model: emb.embedding_model || "unknown",
        embedding_version: 2,
        source_type: emb.source_type,
        source_data: emb.source_data || null,
      }, {
        onConflict: "appid,facet",
      });
    
    if (error) {
      console.error(`Failed to save ${emb.facet} for ${emb.appid}:`, error);
    }
  }
}

async function main() {
  const facetsToRegenerate = process.argv.slice(2);
  const validFacets = ["aesthetic", "atmosphere", "mechanics", "narrative"];
  
  const targetFacets = facetsToRegenerate.length > 0 
    ? facetsToRegenerate.filter(f => validFacets.includes(f))
    : ["aesthetic", "atmosphere"];
  
  console.log("=== Regenerate Ground Truth Embeddings ===\n");
  console.log(`Regenerating facets: ${targetFacets.join(", ")}\n`);
  
  const appIds = await getUniqueAppIds();
  console.log(`Found ${appIds.length} unique games in ground truth dataset\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const appid of appIds) {
    const game = await getGameData(appid);
    if (!game) {
      console.log(`✗ ${appid}: Not found in database`);
      failed++;
      continue;
    }
    
    console.log(`Processing ${game.title} (${appid})...`);
    
    try {
      await deleteExistingEmbeddings(appid, targetFacets);
      
      const embeddings = await generateAllEmbeddings(game, targetFacets as any);
      
      if (embeddings.length > 0) {
        await saveEmbeddings(embeddings);
        console.log(`  ✓ Generated ${embeddings.length} embeddings`);
        processed++;
      } else {
        console.log(`  ⚠ No embeddings generated`);
      }
    } catch (error) {
      console.error(`  ✗ Failed:`, error);
      failed++;
    }
  }
  
  console.log("\n=== Summary ===");
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
