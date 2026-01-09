/**
 * APPROACH A: AI-First with Tag Validation
 * 
 * Flow: Perplexity suggests → SteamSpy validates tag overlap → reject mismatches
 * 
 * Pros: Leverages AI creativity for discovery
 * Cons: Still dependent on AI quality, validation is reactive
 */

import { TEST_CASES } from "./test-games";
import { fetchSteamSpyGame, calculateTagOverlap, hasVibeConflict, getTopTags } from "./steamspy-client";

type ValidationResult = {
  appid: number;
  name: string;
  valid: boolean;
  score: number;
  shared: string[];
  vibeConflict: boolean;
  reason?: string;
};

async function validateSuggestion(
  sourceAppid: number,
  suggestedAppid: number,
  suggestedName: string,
  minScore = 0.13
): Promise<ValidationResult> {
  const [source, suggested] = await Promise.all([
    fetchSteamSpyGame(sourceAppid),
    fetchSteamSpyGame(suggestedAppid),
  ]);

  if (!source || Object.keys(source.tags).length === 0) {
    return { appid: suggestedAppid, name: suggestedName, valid: true, score: 1, shared: [], vibeConflict: false, reason: "Source has no tags" };
  }

  if (!suggested || Object.keys(suggested.tags).length === 0) {
    return { appid: suggestedAppid, name: suggestedName, valid: true, score: 0.5, shared: [], vibeConflict: false, reason: "Suggested has no tags" };
  }

  const { score, shared, sourceTop, targetTop } = calculateTagOverlap(source.tags, suggested.tags);
  const vibeConflict = hasVibeConflict(sourceTop, targetTop);

  if (vibeConflict) {
    return { appid: suggestedAppid, name: suggestedName, valid: false, score, shared, vibeConflict: true, reason: "Vibe conflict" };
  }

  if (score < minScore) {
    return { appid: suggestedAppid, name: suggestedName, valid: false, score, shared, vibeConflict: false, reason: `Score ${(score * 100).toFixed(0)}% < ${(minScore * 100).toFixed(0)}%` };
  }

  return { appid: suggestedAppid, name: suggestedName, valid: true, score, shared, vibeConflict: false };
}

async function testApproachA() {
  console.log("=== APPROACH A: AI-First with Tag Validation ===\n");

  for (const testCase of TEST_CASES) {
    console.log(`\n--- ${testCase.name} (${testCase.appid}) ---`);

    const sourceData = await fetchSteamSpyGame(testCase.appid);
    if (sourceData) {
      console.log(`Source tags: ${getTopTags(sourceData.tags, 8).join(", ")}`);
    }

    if (testCase.knownBadSuggestions.length > 0) {
      console.log("\nKnown BAD suggestions (should be rejected):");
      for (const bad of testCase.knownBadSuggestions) {
        const result = await validateSuggestion(testCase.appid, bad.appid, bad.name);
        const status = result.valid ? "❌ WRONGLY ACCEPTED" : "✓ CORRECTLY REJECTED";
        console.log(`  ${status}: ${bad.name}`);
        console.log(`    Score: ${(result.score * 100).toFixed(0)}%, Shared: [${result.shared.join(", ")}]`);
        if (result.reason) console.log(`    Reason: ${result.reason}`);
      }
    }

    if (testCase.knownGoodSuggestions.length > 0) {
      console.log("\nKnown GOOD suggestions (should be accepted):");
      for (const good of testCase.knownGoodSuggestions) {
        const result = await validateSuggestion(testCase.appid, good.appid, good.name);
        const status = result.valid ? "✓ CORRECTLY ACCEPTED" : "❌ WRONGLY REJECTED";
        console.log(`  ${status}: ${good.name}`);
        console.log(`    Score: ${(result.score * 100).toFixed(0)}%, Shared: [${result.shared.join(", ")}]`);
        if (result.reason) console.log(`    Reason: ${result.reason}`);
      }
    }
  }
}

testApproachA().catch(console.error);
