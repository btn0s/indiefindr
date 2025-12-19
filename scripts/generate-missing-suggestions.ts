#!/usr/bin/env npx tsx

/**
 * Script to generate suggestions for games that don't have them yet
 * Usage: npx tsx scripts/generate-missing-suggestions.ts [baseUrl] [limit]
 * Example: npx tsx scripts/generate-missing-suggestions.ts http://localhost:3000 10
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

const baseUrl = process.argv[2] || "http://localhost:3000";
const limit = parseInt(process.argv[3], 10) || 50;

interface GameRow {
  appid: number;
  title: string;
}

interface SuggestionResult {
  appid: number;
  title: string;
  success: boolean;
  count?: number;
  queuedCount?: number;
  error?: string;
}

interface RefreshResponse {
  success: boolean;
  validatedAppIds?: number[];
  error?: string;
}

interface QueuedGame {
  appid: number;
  steamUrl: string;
}

async function getGamesWithoutSuggestions(): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from("games_new")
    .select("appid, title")
    .or("suggested_game_appids.is.null,suggested_game_appids.eq.[]")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch games: ${error.message}`);
  }

  return (data as GameRow[]) || [];
}

async function checkGamesExist(appids: number[]): Promise<number[]> {
  if (appids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appids);

  if (error) {
    console.error(`⚠️  Error checking existing games: ${error.message}`);
    return [];
  }

  const existingAppids = new Set((data || []).map((g) => g.appid));
  return appids.filter((appid) => !existingAppids.has(appid));
}

async function queueGamesForIngestion(
  appids: number[]
): Promise<QueuedGame[]> {
  if (appids.length === 0) {
    return [];
  }

  const gamesToQueue: QueuedGame[] = appids.map((appid) => ({
    appid,
    steamUrl: `https://store.steampowered.com/app/${appid}/`,
  }));

  // Check if any of these are already queued
  const { data: existingJobs, error: checkError } = await supabase
    .from("ingest_jobs")
    .select("steam_appid")
    .in("steam_appid", appids)
    .in("status", ["queued", "running"]);

  if (checkError) {
    console.error(`⚠️  Error checking existing jobs: ${checkError.message}`);
  }

  const queuedAppids = new Set(
    (existingJobs || []).map((job) => job.steam_appid)
  );
  const newGamesToQueue = gamesToQueue.filter(
    (g) => !queuedAppids.has(g.appid)
  );

  if (newGamesToQueue.length === 0) {
    return [];
  }

  const { error: insertError } = await supabase.from("ingest_jobs").insert(
    newGamesToQueue.map((g) => ({
      steam_url: g.steamUrl,
      steam_appid: g.appid,
      status: "queued",
    }))
  );

  if (insertError) {
    console.error(`⚠️  Error queueing games: ${insertError.message}`);
    return [];
  }

  return newGamesToQueue;
}

async function generateSuggestions(
  appid: number,
  title: string
): Promise<{
  success: boolean;
  count?: number;
  queuedCount?: number;
  error?: string;
}> {
  const url = `${baseUrl}/api/games/${appid}/suggestions/refresh`;

  console.log(`\n🔄 Generating suggestions for: ${title} (${appid})...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = (await response.json()) as RefreshResponse;

    if (!response.ok || !data.success) {
      console.error(`❌ Failed: ${data.error || "Unknown error"}`);
      return { success: false, error: data.error };
    }

    const validatedAppIds = data.validatedAppIds || [];
    console.log(
      `✅ Success! Found ${validatedAppIds.length} suggestions`
    );

    // Check which suggested games don't exist in the database
    const missingAppids = await checkGamesExist(validatedAppIds);
    
    if (missingAppids.length > 0) {
      console.log(
        `📋 Found ${missingAppids.length} suggested games not in database, adding to queue...`
      );
      const queued = await queueGamesForIngestion(missingAppids);
      console.log(`✅ Queued ${queued.length} games for ingestion`);
      return {
        success: true,
        count: validatedAppIds.length,
        queuedCount: queued.length,
      };
    }

    return {
      success: true,
      count: validatedAppIds.length,
      queuedCount: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error: ${message}`);
    return { success: false, error: message };
  }
}

async function main(): Promise<void> {
  console.log("🔍 Fetching games without suggestions...");
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`📊 Limit: ${limit}\n`);

  const games = await getGamesWithoutSuggestions();

  if (games.length === 0) {
    console.log("✨ All games already have suggestions!");
    return;
  }

  console.log(`📦 Found ${games.length} games without suggestions`);

  const results: SuggestionResult[] = [];

  // Process games sequentially to avoid overwhelming the API
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const result = await generateSuggestions(game.appid, game.title);
    results.push({ ...game, ...result });

    // Delay between requests (Perplexity has rate limits)
    if (i < games.length - 1) {
      console.log("⏳ Waiting 2s before next request...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log("=".repeat(50));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach((r) => {
    const queuedInfo =
      r.queuedCount !== undefined && r.queuedCount > 0
        ? `, ${r.queuedCount} queued for ingestion`
        : "";
    console.log(
      `   - ${r.title} (${r.appid}): ${r.count} suggestions${queuedInfo}`
    );
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach((r) => {
      console.log(`   - ${r.title} (${r.appid}): ${r.error}`);
    });
  }

  console.log("\n✨ Done!");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
