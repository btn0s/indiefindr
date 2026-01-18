#!/usr/bin/env npx tsx

/**
 * Script to re-ingest a game by appid
 * Usage: npx tsx scripts/reingest-game.ts <appid>
 * Example: npx tsx scripts/reingest-game.ts 3710210
 */

import { config } from "dotenv";
import { ingest } from "../src/lib/ingest";

// Load environment variables
config({ path: [".env.local"] });

async function main() {
  const appid = process.argv[2];

  if (!appid) {
    console.error("❌ Usage: npx tsx scripts/reingest-game.ts <appid>");
    process.exit(1);
  }

  const appIdNum = parseInt(appid, 10);
  if (isNaN(appIdNum)) {
    console.error(`❌ Invalid appid: ${appid}`);
    process.exit(1);
  }

  const steamUrl = `https://store.steampowered.com/app/${appIdNum}/`;

  console.log(`🔄 Re-ingesting game ${appIdNum}...`);
  console.log(`   URL: ${steamUrl}\n`);

  try {
    const result = await ingest(steamUrl, false, true); // skipEmbeddings=false, force=true

    console.log(`✅ Successfully re-ingested game ${appIdNum}`);
    console.log(`   Title: ${result.steamData.title}`);
    console.log(`   AppID: ${result.steamData.appid}`);
    console.log(`   Embeddings: generating in background`);
  } catch (error) {
    console.error(`❌ Failed to re-ingest game ${appIdNum}:`, error);
    const message = error instanceof Error ? error.message : String(error);
    process.exit(1);
  }
}

void main();
