#!/usr/bin/env npx tsx

/**
 * Test new hybrid system on a specific game and compare with existing suggestions
 */

import { config } from "dotenv";
import { getSupabaseServerClient } from "../src/lib/supabase/server";
import { suggestGamesVibeFromAppId } from "../src/lib/suggest";

config({ path: [".env.local"] });

async function main() {
  const appid = 4037180;
  const supabase = getSupabaseServerClient();

  console.log("=".repeat(70));
  console.log(`TESTING GAME: ${appid}`);
  console.log("=".repeat(70));

  // Get game info
  const { data: game } = await supabase
    .from("games_new")
    .select("appid, title, short_description, developers")
    .eq("appid", appid)
    .single();

  if (!game) {
    console.error("Game not found!");
    process.exit(1);
  }

  console.log(`\nGame: ${game.title}`);
  console.log(`Devs: ${game.developers?.join(", ") || "N/A"}`);
  console.log(`Desc: ${game.short_description?.substring(0, 150)}...`);

  // Get existing suggestions from DB
  const { data: existingSuggestions } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appid)
    .order("created_at", { ascending: false });

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("EXISTING SUGGESTIONS IN DB");
  console.log("=".repeat(70));
  console.log(`Found ${existingSuggestions?.length || 0} existing suggestions\n`);

  if (existingSuggestions && existingSuggestions.length > 0) {
    // Get game titles for existing suggestions
    const existingAppids = existingSuggestions.map(s => s.suggested_appid);
    const { data: existingGames } = await supabase
      .from("games_new")
      .select("appid, title")
      .in("appid", existingAppids);

    const gamesMap = new Map(existingGames?.map(g => [g.appid, g.title]) || []);

    existingSuggestions.forEach((s, i) => {
      const title = gamesMap.get(s.suggested_appid) || `AppID ${s.suggested_appid}`;
      console.log(`${i + 1}. ${title} (${s.suggested_appid})`);
      console.log(`   → ${s.reason}`);
    });
  }

  // Test new hybrid system
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("NEW HYBRID SYSTEM RESULTS");
  console.log("=".repeat(70));

  try {
    const start = Date.now();
    const result = await suggestGamesVibeFromAppId(appid, 10);
    const totalTime = Date.now() - start;

    console.log(`\n✅ Generated ${result.suggestions.length} suggestions in ${totalTime}ms`);
    console.log(`\nTiming breakdown:`);
    console.log(`  Strategies (parallel): ${result.timing.strategies}ms`);
    console.log(`  Validation: ${result.timing.validation}ms`);
    console.log(`  Curation: ${result.timing.curation}ms`);
    console.log(`  Total: ${result.timing.total}ms`);

    console.log(`\nStats:`);
    console.log(`  Total unique: ${result.stats.totalUnique}`);
    console.log(`  High consensus (2+): ${result.stats.highConsensus}`);
    console.log(`  From DB: ${result.stats.fromDb}`);
    console.log(`  From Steam: ${result.stats.fromSteam}`);
    console.log(`  Unverified (filtered): ${result.stats.unverified}`);

    console.log(`\nNew suggestions:`);
    result.suggestions.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title} (${s.appId})`);
      console.log(`   → ${s.explanation}`);
    });

    // Compare
    console.log(`\n\n${"=".repeat(70)}`);
    console.log("COMPARISON");
    console.log("=".repeat(70));

    const existingAppidsSet = new Set(existingSuggestions?.map(s => s.suggested_appid) || []);
    const newAppidsSet = new Set(result.suggestions.map(s => s.appId));

    const overlap = result.suggestions.filter(s => existingAppidsSet.has(s.appId));
    const newOnly = result.suggestions.filter(s => !existingAppidsSet.has(s.appId));
    const oldOnly = existingSuggestions?.filter(s => !newAppidsSet.has(s.suggested_appid)) || [];

    console.log(`\nOverlap: ${overlap.length} games`);
    if (overlap.length > 0) {
      overlap.forEach(s => {
        console.log(`  ✅ ${s.title} (${s.appId})`);
      });
    }

    console.log(`\nNew only (${newOnly.length}):`);
    if (newOnly.length > 0) {
      newOnly.forEach(s => {
        console.log(`  🆕 ${s.title} (${s.appId})`);
        console.log(`     → ${s.explanation}`);
      });
    }

    console.log(`\nOld only (${oldOnly.length}):`);
    if (oldOnly.length > 0) {
      const oldGamesMap = new Map(
        (await supabase
          .from("games_new")
          .select("appid, title")
          .in("appid", oldOnly.map(s => s.suggested_appid))
        ).data?.map(g => [g.appid, g.title]) || []
      );

      oldOnly.forEach(s => {
        const title = oldGamesMap.get(s.suggested_appid) || `AppID ${s.suggested_appid}`;
        console.log(`  📌 ${title} (${s.suggested_appid})`);
        console.log(`     → ${s.reason}`);
      });
    }

  } catch (err) {
    console.error(`❌ Error: ${err}`);
  }
}

main().catch(console.error);
