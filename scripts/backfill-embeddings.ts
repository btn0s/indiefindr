#!/usr/bin/env npx tsx

/**
 * Script to backfill embeddings for existing games
 *
 * Generates AESTHETIC, MECHANICS, and NARRATIVE embeddings for all games
 * that don't already have them.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts              # All games
 *   npx tsx scripts/backfill-embeddings.ts --limit 10   # First 10 games
 *   npx tsx scripts/backfill-embeddings.ts --appid 123  # Specific game
 *   npx tsx scripts/backfill-embeddings.ts --facet aesthetic  # Specific facet only
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  generateAllEmbeddings,
  getAvailableFacets,
  type GameWithIgdb,
  type EmbeddingInput,
  type FacetType,
} from "../src/lib/embeddings";

// Load environment variables
config({ path: [".env.local"] });

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const appidArg = args.find((a) => a.startsWith("--appid="));
const facetArg = args.find((a) => a.startsWith("--facet="));
const dryRun = args.includes("--dry-run");

const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;
const specificAppId = appidArg ? parseInt(appidArg.split("=")[1]) : undefined;
const specificFacet = facetArg ? (facetArg.split("=")[1] as FacetType) : undefined;

// Create Supabase client with service role for writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DELAY_BETWEEN_GAMES_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGamesToProcess(): Promise<GameWithIgdb[]> {
  console.log("Fetching games to process...\n");

  let query = supabase
    .from("games_new")
    .select(
      `
      appid,
      title,
      header_image,
      screenshots,
      short_description,
      long_description,
      steamspy_tags,
      raw
    `
    )
    .order("created_at", { ascending: false });

  // Filter by specific appid if provided
  if (specificAppId) {
    query = query.eq("appid", specificAppId);
  }

  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }

  const { data: games, error } = await query;

  if (error) {
    console.error("Error fetching games:", error);
    process.exit(1);
  }

  if (!games || games.length === 0) {
    console.log("No games found to process");
    process.exit(0);
  }

  console.log(`Found ${games.length} games\n`);

  // Fetch IGDB data for these games
  const appIds = games.map((g) => g.appid);
  const { data: igdbData } = await supabase
    .from("game_igdb_data")
    .select("*")
    .in("appid", appIds);

  const igdbByAppId = new Map(igdbData?.map((d) => [d.appid, d]) || []);

  // Combine game data with IGDB data
  return games.map((game) => ({
    ...game,
    screenshots: game.screenshots || [],
    igdb_data: igdbByAppId.get(game.appid) || null,
  }));
}

async function getExistingEmbeddings(appIds: number[]): Promise<Map<number, Set<FacetType>>> {
  const { data: existing } = await supabase
    .from("game_embeddings")
    .select("appid, facet")
    .in("appid", appIds);

  const result = new Map<number, Set<FacetType>>();

  for (const row of existing || []) {
    if (!result.has(row.appid)) {
      result.set(row.appid, new Set());
    }
    result.get(row.appid)!.add(row.facet as FacetType);
  }

  return result;
}

async function saveEmbedding(input: EmbeddingInput): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would save ${input.facet} embedding for ${input.appid}`);
    return true;
  }

  const { error } = await supabase.from("game_embeddings").upsert(
    {
      appid: input.appid,
      facet: input.facet,
      embedding: input.embedding,
      embedding_model: input.embedding_model || "unknown",
      embedding_version: 1,
      source_type: input.source_type,
      source_data: input.source_data || null,
    },
    { onConflict: "appid,facet" }
  );

  if (error) {
    console.error(`  Error saving ${input.facet} embedding:`, error.message);
    return false;
  }

  return true;
}

async function main() {
  console.log("=".repeat(60));
  console.log("EMBEDDING BACKFILL");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  if (specificAppId) {
    console.log(`Processing specific game: ${specificAppId}`);
  }

  if (specificFacet) {
    console.log(`Processing specific facet: ${specificFacet}`);
  }

  if (limit) {
    console.log(`Limiting to ${limit} games`);
  }

  console.log("");

  // Fetch games
  const games = await fetchGamesToProcess();

  // Get existing embeddings to avoid re-generating
  const existingEmbeddings = await getExistingEmbeddings(games.map((g) => g.appid));

  // Stats
  let totalProcessed = 0;
  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each game
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`\n[${i + 1}/${games.length}] ${game.title} (${game.appid})`);

    // Determine which facets to generate
    const existingFacets = existingEmbeddings.get(game.appid) || new Set();
    const availableFacets = getAvailableFacets(game);

    let facetsToGenerate: FacetType[];

    if (specificFacet) {
      // Generate only specific facet if not already exists
      facetsToGenerate = existingFacets.has(specificFacet) ? [] : [specificFacet];
    } else {
      // Generate all available facets that don't exist yet
      facetsToGenerate = availableFacets.filter((f) => !existingFacets.has(f));
    }

    if (facetsToGenerate.length === 0) {
      console.log("  ⏭️  All facets already exist, skipping");
      totalSkipped++;
      continue;
    }

    console.log(`  Generating: ${facetsToGenerate.join(", ")}`);
    console.log(`  (Already has: ${Array.from(existingFacets).join(", ") || "none"})`);

    try {
      // Generate embeddings
      const embeddings = await generateAllEmbeddings(game, facetsToGenerate);

      // Save embeddings
      for (const embedding of embeddings) {
        const saved = await saveEmbedding(embedding);
        if (saved) {
          totalGenerated++;
        } else {
          totalErrors++;
        }
      }

      totalProcessed++;
    } catch (error) {
      console.error(`  Error processing game:`, error);
      totalErrors++;
    }

    // Rate limiting between games
    if (i < games.length - 1) {
      await sleep(DELAY_BETWEEN_GAMES_MS);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Games processed:    ${totalProcessed}`);
  console.log(`Games skipped:      ${totalSkipped}`);
  console.log(`Embeddings created: ${totalGenerated}`);
  console.log(`Errors:             ${totalErrors}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
