#!/usr/bin/env npx tsx

/**
 * Ingest top indie games on Steam for SEO/discoverability.
 * 
 * These are high-traffic games that will help the site rank for common searches.
 */

const TOP_INDIE_GAMES = [
  // Classic Indies
  { appid: 413150, title: "Stardew Valley" },
  { appid: 105600, title: "Terraria" },
  { appid: 391540, title: "Undertale" },
  { appid: 268910, title: "Cuphead" },
  { appid: 250760, title: "Shovel Knight: Treasure Trove" },
  
  // Modern Hits
  { appid: 1868140, title: "DAVE THE DIVER" },
  { appid: 1313140, title: "Cult of the Lamb" },
  { appid: 753640, title: "Outer Wilds" },
  { appid: 294100, title: "RimWorld" },
  { appid: 264710, title: "Subnautica" },
  { appid: 262060, title: "Darkest Dungeon" },
  
  // Multiplayer Indies
  { appid: 945360, title: "Among Us" },
  { appid: 2881650, title: "Content Warning" },
  { appid: 1966720, title: "Lethal Company" },
  
  // Recent Breakouts
  { appid: 2231450, title: "Pizza Tower" },
  { appid: 1942280, title: "Brotato" },
  { appid: 1458140, title: "Pacific Drive" },
  { appid: 1562430, title: "DREDGE" },
  { appid: 1623730, title: "Palworld" },
];

const API_URL = process.env.API_URL || "http://localhost:3000";

async function ingestGame(appid: number, title: string): Promise<boolean> {
  const steamUrl = `https://store.steampowered.com/app/${appid}/`;
  
  console.log(`\n[${title}] Ingesting...`);
  
  try {
    const response = await fetch(`${API_URL}/api/games/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamUrl }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`[${title}] ✓ Success! App ID: ${data.appid}`);
      return true;
    } else {
      console.error(`[${title}] ✗ Failed: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`[${title}] ✗ Error:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Ingesting Top Indie Games");
  console.log("=".repeat(60));
  console.log(`\nTotal games to process: ${TOP_INDIE_GAMES.length}`);
  console.log(`API URL: ${API_URL}`);
  
  let succeeded = 0;
  let failed = 0;
  
  for (const game of TOP_INDIE_GAMES) {
    const success = await ingestGame(game.appid, game.title);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
    
    // Small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`✓ Succeeded: ${succeeded}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${TOP_INDIE_GAMES.length}`);
}

main().catch(console.error);
