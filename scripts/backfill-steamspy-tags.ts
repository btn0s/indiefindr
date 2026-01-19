/**
 * Backfill steamspy_tags for all games in the database.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-steamspy-tags.ts [limit]
 *   pnpm tsx scripts/backfill-steamspy-tags.ts 100  # Only process 100 games
 *   pnpm tsx scripts/backfill-steamspy-tags.ts      # Process all games
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  fetchSteamSpyData,
  fetchSteamStoreTags,
  tagsArrayToRecord,
} from "../src/lib/utils/steamspy";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 5000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameToEnrich {
  appid: number;
  title: string;
  steamspy_tags: Record<string, number> | null;
}

async function getGamesToEnrich(limit?: number): Promise<GameToEnrich[]> {
  let query = supabase
    .from("games_new")
    .select("appid, title, steamspy_tags")
    .or("steamspy_tags.is.null,steamspy_tags.eq.{}");

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch games: ${error.message}`);
  }

  return data || [];
}

async function enrichGame(
  game: GameToEnrich
): Promise<{ success: boolean; tags: number; source: string }> {
  const steamspyData = await fetchSteamSpyData(game.appid);

  if (steamspyData && Object.keys(steamspyData.tags).length > 0) {
    const { error } = await supabase
      .from("games_new")
      .update({
        steamspy_tags: steamspyData.tags,
        steamspy_owners: steamspyData.owners,
        steamspy_positive: steamspyData.positive,
        steamspy_negative: steamspyData.negative,
        steamspy_updated_at: new Date().toISOString(),
      })
      .eq("appid", game.appid);

    if (error) {
      console.error(`  Failed to update ${game.appid}:`, error.message);
      return { success: false, tags: 0, source: "error" };
    }

    return {
      success: true,
      tags: Object.keys(steamspyData.tags).length,
      source: "steamspy",
    };
  }

  const storeTags = await fetchSteamStoreTags(game.appid);

  if (storeTags.length > 0) {
    const tagsRecord = tagsArrayToRecord(storeTags);
    const { error } = await supabase
      .from("games_new")
      .update({
        steamspy_tags: tagsRecord,
        steamspy_updated_at: new Date().toISOString(),
      })
      .eq("appid", game.appid);

    if (error) {
      console.error(`  Failed to update ${game.appid}:`, error.message);
      return { success: false, tags: 0, source: "error" };
    }

    return { success: true, tags: storeTags.length, source: "steam-store" };
  }

  return { success: false, tags: 0, source: "no-data" };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;

  console.log("\n=== SteamSpy Tags Backfill ===\n");
  console.log(`Limit: ${limit || "all"}`);

  const games = await getGamesToEnrich(limit);
  console.log(`Found ${games.length} games needing tags\n`);

  if (games.length === 0) {
    console.log("All games already have tags. Nothing to do.");
    return;
  }

  let success = 0;
  let failed = 0;
  let totalTags = 0;
  const sources: Record<string, number> = {};

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    console.log(
      `\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(games.length / BATCH_SIZE)} ---`
    );

    for (const game of batch) {
      console.log(`  Processing ${game.appid}: ${game.title}...`);
      const result = await enrichGame(game);

      if (result.success) {
        console.log(
          `    ✓ ${result.tags} tags from ${result.source}`
        );
        success++;
        totalTags += result.tags;
        sources[result.source] = (sources[result.source] || 0) + 1;
      } else {
        console.log(`    ✗ ${result.source}`);
        failed++;
        sources[result.source] = (sources[result.source] || 0) + 1;
      }
    }

    if (i + BATCH_SIZE < games.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Success: ${success} games`);
  console.log(`Failed: ${failed} games`);
  console.log(`Total tags added: ${totalTags}`);
  console.log(`Sources:`, sources);
}

main().catch(console.error);
