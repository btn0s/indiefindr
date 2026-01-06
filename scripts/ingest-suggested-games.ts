#!/usr/bin/env npx tsx

/**
 * Script to ingest suggested games that don't exist in the database yet
 * Usage: npx tsx scripts/ingest-suggested-games.ts [appid]
 * Example: npx tsx scripts/ingest-suggested-games.ts 1807500
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: [".env.local"] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error(
    "   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Suggestion {
  appId: number;
  explanation: string;
}

async function ingestSuggestedGames(appid: number) {
  console.log(`\n🔍 Checking game ${appid}...\n`);

  // Get the game and its suggested appids
  const { data: game, error } = await supabase
    .from("games_new")
    .select("appid, title, suggested_game_appids")
    .eq("appid", appid)
    .maybeSingle();

  if (error || !game) {
    console.error(`❌ Game ${appid} not found`);
    return;
  }

  const suggestions: Suggestion[] = game.suggested_game_appids || [];
  const suggestedAppIds = suggestions.map((s) => s.appId);

  console.log(`✓ Found: ${game.title}`);
  console.log(`  Suggested games: ${suggestions.length}\n`);

  if (suggestions.length === 0) {
    console.log("⚠️  No suggested games to ingest");
    return;
  }

  // Check which suggested games already exist
  const { data: existingGames } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", suggestedAppIds);

  const existingAppids = new Set((existingGames || []).map((g) => g.appid));
  const missingAppids = suggestedAppIds.filter(
    (id: number) => !existingAppids.has(id)
  );

  console.log(`📊 Status:`);
  console.log(`   Total suggested: ${suggestions.length}`);
  console.log(`   Already in DB: ${existingAppids.size}`);
  console.log(`   Missing: ${missingAppids.length}\n`);

  if (missingAppids.length === 0) {
    console.log("✅ All suggested games already exist in database!");
    return;
  }

  console.log(`📥 Missing games to ingest: ${missingAppids.join(", ")}\n`);

  // Ingest missing games via API
  const baseUrl = process.argv[2] || "http://localhost:3000";
  console.log(`🌐 Using API endpoint: ${baseUrl}/api/games/submit\n`);

  const results = [];
  for (const missingAppid of missingAppids) {
    const steamUrl = `https://store.steampowered.com/app/${missingAppid}/`;
    console.log(`⏳ Ingesting ${missingAppid}...`);

    try {
      const response = await fetch(`${baseUrl}/api/games/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl, skipSuggestions: true }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Success: ${data.title || missingAppid}`);
        results.push({ appid: missingAppid, success: true, title: data.title });
      } else {
        console.log(`   ❌ Failed: ${data.error || "Unknown error"}`);
        results.push({
          appid: missingAppid,
          success: false,
          error: data.error || "Unknown error",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`   ❌ Error: ${errorMessage}`);
      results.push({
        appid: missingAppid,
        success: false,
        error: errorMessage,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Summary:`);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  console.log(`   ✅ Succeeded: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);

  if (failureCount > 0) {
    console.log(`\n❌ Failed games:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   ${r.appid}: ${r.error}`);
      });
  }
}

const appid = parseInt(process.argv[2] || "1807500", 10);
if (isNaN(appid)) {
  console.error(
    "❌ Invalid appid. Usage: npx tsx scripts/ingest-suggested-games.ts [appid]"
  );
  process.exit(1);
}

ingestSuggestedGames(appid).catch(console.error);
