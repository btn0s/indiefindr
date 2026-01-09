/**
 * APPROACH C: Hybrid (Deterministic Base + AI Enhancement)
 * 
 * Flow:
 * 1. Same developer/publisher games (guaranteed vibe, fast)
 * 2. SteamSpy tag search for similar games (deterministic)
 * 3. AI suggestions (creative discovery)
 * 4. Validate ALL with tag overlap + vibe conflict check
 * 
 * Pros: Best of both worlds - guaranteed matches + creative discovery
 * Cons: More complex, slower than pure AI
 */

import { TEST_CASES } from "./test-games";
import {
  fetchSteamSpyGame,
  fetchGamesByTag,
  fetchGamesByDeveloper,
  fetchGamesByPublisher,
  calculateTagOverlap,
  hasVibeConflict,
  getTopTags,
  SteamSpyGame,
} from "./steamspy-client";

type Candidate = {
  appid: number;
  name: string;
  score: number;
  shared: string[];
  source: "same-dev" | "same-pub" | "tag-search" | "ai";
  developer: string;
};

async function findSameDeveloperGames(
  sourceAppid: number,
  sourceData: SteamSpyGame
): Promise<Candidate[]> {
  if (!sourceData.developer) return [];

  const developers = sourceData.developer.split(",").map((d) => d.trim()).filter(Boolean);
  const allAppIds = new Set<number>();

  for (const dev of developers.slice(0, 2)) {
    const appIds = await fetchGamesByDeveloper(dev);
    appIds.forEach((id) => allAppIds.add(id));
  }

  allAppIds.delete(sourceAppid);

  const results: Candidate[] = [];
  for (const appid of Array.from(allAppIds).slice(0, 10)) {
    const game = await fetchSteamSpyGame(appid);
    if (!game || !game.name) continue;
    if (game.name.toLowerCase().includes("soundtrack")) continue;
    if (game.name.toLowerCase().includes("art book")) continue;
    if (game.name.toLowerCase().includes("work in progress")) continue;

    const { score, shared } = calculateTagOverlap(sourceData.tags, game.tags);

    results.push({
      appid,
      name: game.name,
      score: Math.max(score, 0.8),
      shared,
      source: "same-dev",
      developer: game.developer,
    });
  }

  return results;
}

async function findTagBasedCandidates(
  sourceAppid: number,
  sourceData: SteamSpyGame,
  limit = 15
): Promise<Candidate[]> {
  const topTags = getTopTags(sourceData.tags, 4);
  if (topTags.length === 0) return [];

  const candidateMap = new Map<number, { hitCount: number }>();

  for (const tag of topTags) {
    const games = await fetchGamesByTag(tag);
    for (const game of games) {
      if (game.appid === sourceAppid) continue;
      const existing = candidateMap.get(game.appid);
      if (existing) {
        existing.hitCount++;
      } else {
        candidateMap.set(game.appid, { hitCount: 1 });
      }
    }
  }

  const sorted = Array.from(candidateMap.entries())
    .sort((a, b) => b[1].hitCount - a[1].hitCount)
    .slice(0, 30);

  const results: Candidate[] = [];
  const sourceTopTags = getTopTags(sourceData.tags, 15);

  for (const [appid] of sorted.slice(0, 20)) {
    const game = await fetchSteamSpyGame(appid);
    if (!game || Object.keys(game.tags).length === 0) continue;

    const targetTopTags = getTopTags(game.tags, 15);
    if (hasVibeConflict(sourceTopTags, targetTopTags)) continue;

    const { score, shared } = calculateTagOverlap(sourceData.tags, game.tags);
    if (score < 0.2) continue;

    results.push({
      appid,
      name: game.name || "Unknown",
      score,
      shared,
      source: "tag-search",
      developer: game.developer,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function testApproachC() {
  console.log("=== APPROACH C: Hybrid (Deterministic + AI) ===\n");

  for (const testCase of TEST_CASES.slice(0, 1)) {
    console.log(`\n--- ${testCase.name} (${testCase.appid}) ---`);

    const startTime = Date.now();
    const sourceData = await fetchSteamSpyGame(testCase.appid);

    if (!sourceData) {
      console.log("  Failed to fetch source game");
      continue;
    }

    console.log(`Source: ${sourceData.name}`);
    console.log(`Developer: ${sourceData.developer}`);
    console.log(`Tags: ${getTopTags(sourceData.tags, 8).join(", ")}`);

    console.log("\n[Phase 1] Finding same-developer games...");
    const devGames = await findSameDeveloperGames(testCase.appid, sourceData);
    console.log(`  Found ${devGames.length} games from same developer`);
    for (const g of devGames) {
      console.log(`    - ${g.name} (${g.appid})`);
    }

    console.log("\n[Phase 2] Finding tag-based candidates...");
    const tagGames = await findTagBasedCandidates(testCase.appid, sourceData, 10);
    console.log(`  Found ${tagGames.length} games via tag search`);

    const allCandidates = [...devGames, ...tagGames];
    const uniqueMap = new Map<number, Candidate>();
    for (const c of allCandidates) {
      const existing = uniqueMap.get(c.appid);
      if (!existing || c.score > existing.score) {
        uniqueMap.set(c.appid, c);
      }
    }

    const finalCandidates = Array.from(uniqueMap.values())
      .sort((a, b) => {
        if (a.source === "same-dev" && b.source !== "same-dev") return -1;
        if (b.source === "same-dev" && a.source !== "same-dev") return 1;
        return b.score - a.score;
      })
      .slice(0, 15);

    const elapsed = Date.now() - startTime;

    console.log(`\n=== Final Results (${elapsed}ms) ===`);
    for (const c of finalCandidates) {
      const sourceLabel = c.source === "same-dev" ? "[SAME DEV]" : "[TAG MATCH]";
      console.log(`${sourceLabel} ${c.name} - ${(c.score * 100).toFixed(0)}%`);
      console.log(`  Shared: [${c.shared.slice(0, 5).join(", ")}]`);
    }

    if (testCase.knownGoodSuggestions.length > 0) {
      console.log("\n--- Validation: Known Good Suggestions ---");
      for (const good of testCase.knownGoodSuggestions) {
        const found = finalCandidates.find((c) => c.appid === good.appid);
        if (found) {
          console.log(`  ✓ Found: ${good.name} (${found.source}, ${(found.score * 100).toFixed(0)}%)`);
        } else {
          console.log(`  ❌ Missing: ${good.name}`);
        }
      }
    }

    if (testCase.knownBadSuggestions.length > 0) {
      console.log("\n--- Validation: Known Bad Suggestions ---");
      for (const bad of testCase.knownBadSuggestions) {
        const found = finalCandidates.find((c) => c.appid === bad.appid);
        if (found) {
          console.log(`  ❌ Wrongly included: ${bad.name}`);
        } else {
          console.log(`  ✓ Correctly excluded: ${bad.name}`);
        }
      }
    }
  }
}

testApproachC().catch(console.error);
