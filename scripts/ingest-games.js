#!/usr/bin/env node

/**
 * Script to ingest multiple Steam games
 * Usage: node scripts/ingest-games.js [baseUrl]
 * Example: node scripts/ingest-games.js http://localhost:3000
 */

const games = [
  { name: "Counter-Strike 2", appid: 730 },
  { name: "Dota 2", appid: 570 },
  { name: "PUBG: BATTLEGROUNDS", appid: 578080 },
  { name: "Apex Legends", appid: 1172470 },
  { name: "Grand Theft Auto V", appid: 271590 },
  { name: "The Witcher 3: Wild Hunt", appid: 292030 },
  { name: "Elden Ring", appid: 1245620 },
  { name: "Baldur's Gate 3", appid: 1086940 },
  { name: "Cyberpunk 2077", appid: 1091500 },
  { name: "Red Dead Redemption 2", appid: 1174180 },
];

const baseUrl = process.argv[2] || "http://localhost:3000";
const ingestUrl = `${baseUrl}/api/submit`;

async function ingestGame(name, appid) {
  const steamUrl = `https://store.steampowered.com/app/${appid}/`;

  console.log(`\n📦 Ingesting: ${name} (${appid})...`);

  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steamUrl }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`❌ Failed: ${data.error || "Unknown error"}`);
      return { success: false, error: data.error };
    }

    console.log(`✅ Success! App ID: ${data.appid}, Title: ${data.title}`);
    return { success: true, gameId: data.appid };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`🚀 Starting ingestion of ${games.length} games...`);
  console.log(`📍 Base URL: ${baseUrl}\n`);

  const results = [];
  
  // Process games sequentially to avoid overwhelming the API
  for (const game of games) {
    const result = await ingestGame(game.name, game.appid);
    results.push({ ...game, ...result });
    
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log("=".repeat(50));
  
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach((r) => {
    console.log(`   - ${r.name} (${r.appid})`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach((r) => {
      console.log(`   - ${r.name} (${r.appid}): ${r.error}`);
    });
  }
  
  console.log("\n✨ Done!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
