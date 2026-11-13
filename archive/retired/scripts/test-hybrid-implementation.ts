#!/usr/bin/env npx tsx

/**
 * Test the new hybrid 3-strategy implementation
 */

import { config } from "dotenv";
import { suggestGames } from "../src/lib/suggest";

config({ path: [".env.local"] });

async function main() {
  const testGames = [
    { appid: 2379780, name: "Balatro" },
    { appid: 1145360, name: "Hades" },
    { appid: 1833200, name: "PIGFACE" },
    { appid: 2662730, name: "Eating Nature" },
  ];

  console.log("=".repeat(70));
  console.log("TESTING HYBRID 3-STRATEGY IMPLEMENTATION");
  console.log("=".repeat(70));

  for (const game of testGames) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Testing: ${game.name} (${game.appid})`);
    console.log("=".repeat(70));

    try {
      const start = Date.now();
      const result = await suggestGames(game.appid, 10);
      const totalTime = Date.now() - start;

      console.log(`\nGenerated ${result.suggestions.length} suggestions in ${totalTime}ms`);
      console.log(`\nStats:`);
      console.log(`  Catalog size: ${result.stats.catalogSize}`);
      console.log(`  Candidates scored: ${result.stats.candidatesScored}`);
      console.log(`  Filtered: ${result.stats.filtered}`);

      console.log(`\nTop 10 suggestions:`);
      result.suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.title} (${s.appId})`);
        console.log(`     → ${s.explanation}`);
      });
    } catch (err) {
      console.error(`❌ Error: ${err}`);
    }

    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 2s before next game...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("\n\n✅ Test complete!");
}

main().catch(console.error);
