import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { fetchSteamGame, type SteamGameData } from "../src/lib/steam";
import { generateAllEmbeddings, type GameForEmbedding, type EmbeddingInput } from "../src/lib/embeddings";

const PROD_SITEMAP = "https://games-graph.vercel.app/sitemap.xml";
const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES = 3000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGameIdsFromSitemap(): Promise<number[]> {
  console.log("Fetching game IDs from production sitemap...");
  const res = await fetch(PROD_SITEMAP);
  const xml = await res.text();
  const matches = xml.matchAll(/games\/(\d+)/g);
  const ids = [...matches].map((m) => parseInt(m[1], 10));
  console.log(`Found ${ids.length} games in sitemap`);
  return ids;
}

async function getExistingAppIds(): Promise<Set<number>> {
  const { data } = await supabase.from("games_new").select("appid");
  return new Set((data || []).map((g) => g.appid));
}

async function saveSteamData(steamData: SteamGameData): Promise<void> {
  const { error } = await supabase.from("games_new").upsert(
    {
      appid: steamData.appid,
      screenshots: steamData.screenshots,
      videos: steamData.videos,
      title: steamData.title,
      header_image: steamData.header_image,
      short_description: steamData.short_description,
      long_description: steamData.long_description,
      raw: steamData.raw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "appid" }
  );
  if (error) throw new Error(`Failed to save: ${error.message}`);
}

async function saveEmbeddings(embeddings: EmbeddingInput[]): Promise<void> {
  for (const emb of embeddings) {
    const embStr = `[${emb.embedding.join(",")}]`;
    const { error } = await supabase.from("game_embeddings").upsert(
      {
        appid: emb.appid,
        facet: emb.facet,
        embedding: embStr,
        embedding_model: emb.embedding_model || "unknown",
        embedding_version: 1,
        source_type: emb.source_type,
        source_data: emb.source_data,
      },
      { onConflict: "appid,facet" }
    );
    if (error) console.error(`  Failed to save ${emb.facet}:`, error.message);
  }
}

async function ingestGame(appId: number): Promise<{ title: string; embeddings: number }> {
  const url = `https://store.steampowered.com/app/${appId}`;
  const steamData = await fetchSteamGame(url);
  await saveSteamData(steamData);

  const game: GameForEmbedding = {
    appid: steamData.appid,
    title: steamData.title,
    header_image: steamData.header_image,
    screenshots: steamData.screenshots || [],
    short_description: steamData.short_description,
    long_description: steamData.long_description,
    steamspy_tags: null,
    raw: steamData.raw as GameForEmbedding["raw"],
  };

  const embeddings = await generateAllEmbeddings(game);
  await saveEmbeddings(embeddings);

  return { title: steamData.title, embeddings: embeddings.length };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = parseInt(process.argv[2] || "50", 10);
  const skipExisting = process.argv.includes("--skip-existing");

  console.log(`\nSeeding up to ${limit} games from production`);
  console.log(`Skip existing: ${skipExisting}\n`);

  const allIds = await getGameIdsFromSitemap();
  const existingIds = await getExistingAppIds();
  console.log(`Already have ${existingIds.size} games locally\n`);

  const idsToProcess = skipExisting
    ? allIds.filter((id) => !existingIds.has(id)).slice(0, limit)
    : allIds.slice(0, limit);

  console.log(`Will process ${idsToProcess.length} games\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < idsToProcess.length; i += BATCH_SIZE) {
    const batch = idsToProcess.slice(i, i + BATCH_SIZE);
    console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(idsToProcess.length / BATCH_SIZE)} ---`);

    for (const appId of batch) {
      try {
        console.log(`  Ingesting ${appId}...`);
        const result = await ingestGame(appId);
        console.log(`  ✓ ${appId}: ${result.title} (${result.embeddings} embeddings)`);
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.log(`  ✗ ${appId}: ${msg}`);
        failed++;
      }
    }

    if (i + BATCH_SIZE < idsToProcess.length) {
      console.log(`  Waiting ${DELAY_BETWEEN_BATCHES}ms...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
