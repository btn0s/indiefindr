#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { suggestGamesVibe } from "../../src/lib/suggest-new";
import { TEST_GAMES, TestGame } from "./shared/test-games";
import { TestResult } from "./shared/output";

export async function runBaselineTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const game of TEST_GAMES) {
    const startTime = Date.now();
    
    const result = await suggestGamesVibe(
      game.appid,
      game.title,
      game.description,
      undefined, // developers
      10
    );
    
    const timing = Date.now() - startTime;

    results.push({
      testName: "Test A (Baseline)",
      gameTitle: game.title,
      suggestions: result.suggestions.map(s => ({
        title: s.title,
        appid: s.appId,
        reason: s.explanation,
      })),
      timing,
    });
  }

  return results;
}

if (require.main === module) {
  runBaselineTest()
    .then((results) => {
      console.log("Test A (Baseline) Results:");
      console.log("=".repeat(60));
      for (const result of results) {
        console.log(`\n${result.gameTitle}:`);
        console.log(`Time: ${result.timing}ms`);
        console.log(`Suggestions: ${result.suggestions.length}`);
        result.suggestions.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.title}${s.appid ? ` (${s.appid})` : ""}`);
        });
      }
    })
    .catch(console.error);
}
