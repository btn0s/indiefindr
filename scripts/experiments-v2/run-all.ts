#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { runBaselineTest } from "./test-a-baseline";
import { runSmartPromptTest } from "./test-b-smart-prompt";
import { runTypePlusSingleTest } from "./test-c-type-plus-single";
import { runExamplesInPromptTest } from "./test-d-examples-in-prompt";
import { TestResult } from "./shared/output";
import { formatSideBySide } from "./shared/output";

async function runAllTests() {
  console.log("Running all suggestion experiments...\n");
  console.log("This may take several minutes...\n");

  const startTime = Date.now();

  // Run all tests in parallel
  const [baseline, smartPrompt, typePlusSingle, examples] = await Promise.all([
    runBaselineTest(),
    runSmartPromptTest(),
    runTypePlusSingleTest(),
    runExamplesInPromptTest(),
  ]);

  const totalTime = Date.now() - startTime;

  // Format side-by-side output
  const allResults = [baseline, smartPrompt, typePlusSingle, examples];
  const formatted = formatSideBySide(allResults);

  console.log("\n" + "=".repeat(80));
  console.log("SIDE-BY-SIDE COMPARISON");
  console.log("=".repeat(80));
  console.log(formatted);

  // Summary statistics
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY STATISTICS");
  console.log("=".repeat(80));

  const testNames = [
    "Test A (Baseline)",
    "Test B (Smart Prompt)",
    "Test C (Type+Single)",
    "Test D (Examples)",
  ];

  for (let i = 0; i < allResults.length; i++) {
    const results = allResults[i];
    const avgTime =
      results.reduce((sum, r) => sum + r.timing, 0) / results.length;
    const totalSuggestions = results.reduce(
      (sum, r) => sum + r.suggestions.length,
      0
    );
    const avgSuggestions = totalSuggestions / results.length;
    const validatedCount = results.reduce(
      (sum, r) => sum + r.suggestions.filter((s) => s.appid).length,
      0
    );
    const validationRate = totalSuggestions > 0 ? validatedCount / totalSuggestions : 0;

    console.log(`\n${testNames[i]}:`);
    console.log(`  Avg time per game: ${avgTime.toFixed(0)}ms`);
    console.log(`  Avg suggestions per game: ${avgSuggestions.toFixed(1)}`);
    console.log(`  Validation rate: ${(validationRate * 100).toFixed(1)}%`);
  }

  console.log(`\nTotal time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log("\n" + "=".repeat(80));
  console.log("EVALUATION CRITERIA");
  console.log("=".repeat(80));
  console.log(`
Manual review questions:
1. Would a user looking at Game X be happy to see these suggestions?
2. Do the suggestions match the FEEL of the source game?
3. Any obvious mismatches? (e.g., shooter for narrative game)

Success criteria:
- Quality is subjectively equal or better than baseline
- No obvious category mismatches (action game getting narrative suggestions)
`);

  // Also output detailed per-game comparison
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED PER-GAME COMPARISON");
  console.log("=".repeat(80));

  const { TEST_GAMES } = await import("./shared/test-games");
  for (const game of TEST_GAMES) {
    console.log(`\n=== ${game.title} ===`);
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i].find((r) => r.gameTitle === game.title);
      if (result) {
        console.log(`\n${testNames[i]} (${result.timing}ms):`);
        result.suggestions.forEach((s, idx) => {
          const validated = s.appid ? "✓" : "✗";
          console.log(
            `  ${idx + 1}. ${validated} ${s.title}${s.appid ? ` (${s.appid})` : ""}`
          );
        });
      }
    }
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}
