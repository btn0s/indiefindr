/**
 * APPROACH B: Data-First (Deterministic Candidates)
 * 
 * Flow: SteamSpy tag search → find games with similar tags → rank by overlap
 * 
 * Pros: Deterministic, fast, guaranteed vibe match
 * Cons: Limited to SteamSpy's data, may miss creative connections
 */

import { TEST_CASES } from "./test-games";
import { fetchSteamSpyGame, fetchGamesByTag, calculateTagOverlap, getTopTags } from "./steamspy-client";

type Candidate = {
  appid: number;
  name: string;
  score: number;
  shared: string[];
  developer: string;
};

async function findCandidatesByTags(sourceAppid: number, limit = 20): Promise<Candidate[]> {
  const source = await fetchSteamSpyGame(sourceAppid);
  if (!source || Object.keys(source.tags).length === 0) {
    console.log("  Source has no tags, cannot find candidates");
    return [];
  }

  const topTags = getTopTags(source.tags, 5);
  console.log(`  Searching by tags: ${topTags.join(", ")}`);

  const candidateMap = new Map<number, { name: string; developer: string; hitCount: number }>();

  for (const tag of topTags) {
    const games = await fetchGamesByTag(tag);
    for (const game of games) {
      if (game.appid === sourceAppid) continue;
      const existing = candidateMap.get(game.appid);
      if (existing) {
        existing.hitCount++;
      } else {
        candidateMap.set(game.appid, { name: game.name || "Unknown", developer: game.developer, hitCount: 1 });
      }
    }
  }

  const candidatesWithHits = Array.from(candidateMap.entries())
    .map(([appid, data]) => ({ appid, ...data }))
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 50);

  console.log(`  Found ${candidatesWithHits.length} candidates from tag search`);

  const results: Candidate[] = [];

  for (const candidate of candidatesWithHits.slice(0, 25)) {
    const candidateData = await fetchSteamSpyGame(candidate.appid);
    if (!candidateData || Object.keys(candidateData.tags).length === 0) continue;

    const { score, shared } = calculateTagOverlap(source.tags, candidateData.tags);

    results.push({
      appid: candidate.appid,
      name: candidateData.name || candidate.name,
      score,
      shared,
      developer: candidateData.developer,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function findSameDeveloperGames(sourceAppid: number): Promise<Candidate[]> {
  const source = await fetchSteamSpyGame(sourceAppid);
  if (!source || !source.developer) return [];

  console.log(`  Looking for games by: ${source.developer}`);

  return [];
}

async function testApproachB() {
  console.log("=== APPROACH B: Data-First (Deterministic Candidates) ===\n");

  for (const testCase of TEST_CASES.slice(0, 1)) {
    console.log(`\n--- ${testCase.name} (${testCase.appid}) ---`);

    const startTime = Date.now();
    const candidates = await findCandidatesByTags(testCase.appid, 15);
    const elapsed = Date.now() - startTime;

    console.log(`\nTop candidates (found in ${elapsed}ms):`);
    for (const c of candidates.slice(0, 10)) {
      console.log(`  ${c.name} - ${(c.score * 100).toFixed(0)}% match`);
      console.log(`    Shared: [${c.shared.slice(0, 5).join(", ")}]`);
      console.log(`    Developer: ${c.developer}`);
    }

    if (testCase.knownGoodSuggestions.length > 0) {
      console.log("\nChecking if known good suggestions were found:");
      for (const good of testCase.knownGoodSuggestions) {
        const found = candidates.find((c) => c.appid === good.appid);
        if (found) {
          console.log(`  ✓ Found: ${good.name} (${(found.score * 100).toFixed(0)}% match)`);
        } else {
          console.log(`  ❌ Missing: ${good.name}`);
        }
      }
    }

    if (testCase.knownBadSuggestions.length > 0) {
      console.log("\nChecking if known bad suggestions were excluded:");
      for (const bad of testCase.knownBadSuggestions) {
        const found = candidates.find((c) => c.appid === bad.appid);
        if (found) {
          console.log(`  ❌ Wrongly included: ${bad.name} (${(found.score * 100).toFixed(0)}% match)`);
        } else {
          console.log(`  ✓ Correctly excluded: ${bad.name}`);
        }
      }
    }
  }
}

testApproachB().catch(console.error);
