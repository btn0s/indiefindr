#!/usr/bin/env npx tsx

/**
 * Script to generate new suggestions for:
 * 1. All games in pinned collections
 * 2. Top 50 games on the home page
 * 
 * Usage: npx tsx scripts/generate-suggestions-batch.ts
 */

import { config } from "dotenv";
import { getSupabaseServerClient } from "../src/lib/supabase/server";
import { generateSuggestions } from "../src/lib/actions/suggestions";

// Load environment variables
config({ path: [".env.local"] });

async function main() {
  const supabase = getSupabaseServerClient();

  console.log("🔍 Fetching games to generate suggestions for...\n");

  // 1. Get all games from pinned collections
  const { data: pinnedCollections, error: collectionsError } = await supabase
    .from("collections")
    .select("id")
    .eq("published", true)
    .eq("pinned_to_home", true);

  if (collectionsError) {
    console.error("❌ Error fetching pinned collections:", collectionsError);
    process.exit(1);
  }

  const collectionIds = pinnedCollections?.map((c) => c.id) || [];
  const pinnedAppIds = new Set<number>();

  if (collectionIds.length > 0) {
    const { data: collectionGames, error: gamesError } = await supabase
      .from("collection_games")
      .select("appid")
      .in("collection_id", collectionIds);

    if (gamesError) {
      console.error("❌ Error fetching collection games:", gamesError);
      process.exit(1);
    }

    collectionGames?.forEach((cg) => {
      pinnedAppIds.add(cg.appid);
    });

    console.log(`📌 Found ${pinnedAppIds.size} games in ${collectionIds.length} pinned collection(s)`);
  } else {
    console.log("📌 No pinned collections found");
  }

  // 2. Get top 50 games from home page
  const { data: homeGames, error: homeError } = await supabase
    .from("games_new_home")
    .select("appid")
    .order("home_bucket", { ascending: true })
    .order("suggestions_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("appid", { ascending: true })
    .limit(50);

  if (homeError) {
    console.error("❌ Error fetching home page games:", homeError);
    process.exit(1);
  }

  const homeAppIds = new Set(homeGames?.map((g) => g.appid) || []);
  console.log(`🏠 Found ${homeAppIds.size} games from home page\n`);

  // 3. Combine and deduplicate
  const allAppIds = new Set([...pinnedAppIds, ...homeAppIds]);
  const appIdsArray = Array.from(allAppIds);

  console.log(`📊 Total unique games to process: ${appIdsArray.length}`);
  console.log(`   - Pinned collection games: ${pinnedAppIds.size}`);
  console.log(`   - Home page games: ${homeAppIds.size}`);
  console.log(`   - Overlap: ${pinnedAppIds.size + homeAppIds.size - appIdsArray.length}\n`);

  if (appIdsArray.length === 0) {
    console.log("✅ No games to process");
    return;
  }

  // 4. Generate suggestions for each game
  let successCount = 0;
  let failureCount = 0;
  const errors: Array<{ appid: number; error: string }> = [];

  for (let i = 0; i < appIdsArray.length; i++) {
    const appid = appIdsArray[i];
    const progress = `[${i + 1}/${appIdsArray.length}]`;

    try {
      const result = await generateSuggestions(appid, true); // overwrite mode

      if (result.success) {
        successCount++;
        console.log(`✅ ${progress} AppID ${appid}: Generated ${result.count} suggestions`);
      } else {
        failureCount++;
        const errorMsg = result.error || "Unknown error";
        errors.push({ appid, error: errorMsg });
        console.log(`❌ ${progress} AppID ${appid}: ${errorMsg}`);
      }
    } catch (error) {
      failureCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ appid, error: errorMsg });
      console.log(`❌ ${progress} AppID ${appid}: ${errorMsg}`);
    }

    // Small delay to avoid rate limiting
    if (i < appIdsArray.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 5. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📈 Total: ${appIdsArray.length}`);

  if (errors.length > 0) {
    console.log("\n❌ Errors:");
    errors.forEach(({ appid, error }) => {
      console.log(`   AppID ${appid}: ${error}`);
    });
  }

  console.log("\n✅ Done!");
}

void main();
