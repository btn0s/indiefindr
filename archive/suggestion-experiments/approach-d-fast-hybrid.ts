import { TEST_CASES } from "./test-games";
import {
  fetchSteamSpyGame,
  fetchGamesByTag,
  fetchGamesByDeveloper,
  calculateTagOverlap,
  hasVibeConflict,
  getTopTags,
  SteamSpyGame,
  fetchSteamContentDescriptors,
  isAdultContent,
} from "./steamspy-client";

type Candidate = {
  appid: number;
  name: string;
  score: number;
  shared: string[];
  source: "same-dev" | "tag-search";
  owners: string;
  isIndie: boolean;
  isAdult?: boolean;
};

function parseOwners(owners: string): number {
  const match = owners.match(/^([\d,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

function isNiche(owners: string): boolean {
  const count = parseOwners(owners);
  return count < 500000;
}

async function findSameDeveloperGames(
  sourceAppid: number,
  developer: string
): Promise<Candidate[]> {
  if (!developer) return [];

  const devs = developer.split(",").map((d) => d.trim()).filter(Boolean);
  const appIds = new Set<number>();

  for (const dev of devs.slice(0, 1)) {
    const ids = await fetchGamesByDeveloper(dev);
    ids.forEach((id) => appIds.add(id));
  }

  appIds.delete(sourceAppid);

  const validIds = Array.from(appIds).filter((id) => id !== sourceAppid);

  return validIds.slice(0, 5).map((appid) => ({
    appid,
    name: "Unknown",
    score: 0.9,
    shared: [],
    source: "same-dev" as const,
    owners: "unknown",
    isIndie: true,
  }));
}

async function findTagCandidates(
  sourceAppid: number,
  sourceTags: Record<string, number>,
  limit = 10
): Promise<Candidate[]> {
  const topTags = getTopTags(sourceTags, 2);
  if (topTags.length === 0) return [];

  const candidateMap = new Map<number, { name: string; owners: string; hitCount: number }>();

  for (const tag of topTags) {
    const games = await fetchGamesByTag(tag);
    for (const game of games) {
      if (game.appid === sourceAppid) continue;

      const existing = candidateMap.get(game.appid);
      if (existing) {
        existing.hitCount++;
      } else {
        candidateMap.set(game.appid, {
          name: game.name || "Unknown",
          owners: game.owners,
          hitCount: 1,
        });
      }
    }
  }

  const sorted = Array.from(candidateMap.entries())
    .filter(([_, data]) => isNiche(data.owners))
    .sort((a, b) => b[1].hitCount - a[1].hitCount)
    .slice(0, 15);

  const sourceTopTags = getTopTags(sourceTags, 15);
  const results: Candidate[] = [];

  for (const [appid, data] of sorted) {
    if (results.length >= limit) break;

    const game = await fetchSteamSpyGame(appid);
    if (!game || Object.keys(game.tags).length === 0) continue;

    const targetTopTags = getTopTags(game.tags, 15);
    if (hasVibeConflict(sourceTopTags, targetTopTags)) continue;

    const { score, shared } = calculateTagOverlap(sourceTags, game.tags);
    if (score < 0.25) continue;

    const hasIndieTag = targetTopTags.some((t) => t.toLowerCase() === "indie");

    results.push({
      appid,
      name: game.name || data.name,
      score,
      shared,
      source: "tag-search",
      owners: game.owners,
      isIndie: hasIndieTag,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

async function enrichSameDevGames(
  candidates: Candidate[],
  sourceTags: Record<string, number>
): Promise<Candidate[]> {
  const enriched: Candidate[] = [];

  for (const c of candidates) {
    const game = await fetchSteamSpyGame(c.appid);
    if (!game) continue;

    if (game.name?.toLowerCase().includes("soundtrack")) continue;
    if (game.name?.toLowerCase().includes("art book")) continue;
    if (game.name?.toLowerCase().includes("artbook")) continue;
    if (game.name?.toLowerCase().includes("dlc")) continue;

    const { score, shared } = calculateTagOverlap(sourceTags, game.tags);
    const hasIndieTag = getTopTags(game.tags, 15).some((t) => t.toLowerCase() === "indie");

    enriched.push({
      ...c,
      name: game.name || c.name,
      score: Math.max(score, 0.85),
      shared,
      owners: game.owners,
      isIndie: hasIndieTag,
    });
  }

  return enriched;
}

async function testApproachD() {
  console.log("=== APPROACH D: Fast Hybrid (Optimized) ===\n");
  console.log("Optimizations:");
  console.log("  - Only 2 tag searches (vs 4)");
  console.log("  - Filter by owners < 500k (niche only)");
  console.log("  - Validate only top 10 candidates");
  console.log("  - Skip SteamSpy for same-dev initial search\n");

  for (const testCase of TEST_CASES) {
    console.log(`\n--- ${testCase.name} (${testCase.appid}) ---`);

    const startTime = Date.now();
    const sourceData = await fetchSteamSpyGame(testCase.appid);

    if (!sourceData) {
      console.log("  Failed to fetch source game");
      continue;
    }

    console.log(`Developer: ${sourceData.developer}`);
    console.log(`Tags: ${getTopTags(sourceData.tags, 6).join(", ")}`);
    console.log(`Owners: ${sourceData.owners}`);

    const phase1Start = Date.now();
    console.log("\n[Phase 1] Same-developer games...");
    let devGames = await findSameDeveloperGames(testCase.appid, sourceData.developer);
    devGames = await enrichSameDevGames(devGames, sourceData.tags);
    console.log(`  Found ${devGames.length} (${Date.now() - phase1Start}ms)`);

    const phase2Start = Date.now();
    console.log("\n[Phase 2] Tag-based niche games...");
    const tagGames = await findTagCandidates(testCase.appid, sourceData.tags, 10);
    console.log(`  Found ${tagGames.length} (${Date.now() - phase2Start}ms)`);

    const allCandidates = [...devGames, ...tagGames];
    const uniqueMap = new Map<number, Candidate>();
    for (const c of allCandidates) {
      const existing = uniqueMap.get(c.appid);
      if (!existing || c.score > existing.score) {
        uniqueMap.set(c.appid, c);
      }
    }

    const phase3Start = Date.now();
    console.log("\n[Phase 3] NSFW filtering...");
    const sourceDescriptors = await fetchSteamContentDescriptors(testCase.appid);
    const sourceIsAdult = isAdultContent(sourceDescriptors);
    console.log(`  Source is adult: ${sourceIsAdult}`);
    
    const filteredCandidates: Candidate[] = [];
    for (const c of Array.from(uniqueMap.values())) {
      const descriptors = await fetchSteamContentDescriptors(c.appid);
      c.isAdult = isAdultContent(descriptors);
      
      if (c.isAdult && !sourceIsAdult) {
        console.log(`  FILTERED: ${c.name} (adult content)`);
        continue;
      }
      filteredCandidates.push(c);
    }
    console.log(`  Kept ${filteredCandidates.length}/${uniqueMap.size} (${Date.now() - phase3Start}ms)`);

    const finalCandidates = filteredCandidates
      .sort((a, b) => {
        if (a.source === "same-dev" && b.source !== "same-dev") return -1;
        if (b.source === "same-dev" && a.source !== "same-dev") return 1;
        if (a.isIndie && !b.isIndie) return -1;
        if (!a.isIndie && b.isIndie) return 1;
        return b.score - a.score;
      })
      .slice(0, 12);

    const elapsed = Date.now() - startTime;

    console.log(`\n=== Final Results (${elapsed}ms total) ===`);
    for (const c of finalCandidates) {
      const srcLabel = c.source === "same-dev" ? "[DEV]" : "[TAG]";
      const indieLabel = c.isIndie ? "indie" : "";
      console.log(`${srcLabel} ${c.name} - ${(c.score * 100).toFixed(0)}% ${indieLabel}`);
      console.log(`       Owners: ${c.owners} | Shared: [${c.shared.slice(0, 4).join(", ")}]`);
    }

    if (testCase.knownGoodSuggestions.length > 0) {
      console.log("\n--- Validation: Known Good ---");
      for (const good of testCase.knownGoodSuggestions) {
        const found = finalCandidates.find((c) => c.appid === good.appid);
        if (found) {
          console.log(`  ✓ ${good.name}`);
        } else {
          console.log(`  ❌ ${good.name}`);
        }
      }
    }

    if (testCase.knownBadSuggestions.length > 0) {
      console.log("\n--- Validation: Known Bad (should be excluded) ---");
      for (const bad of testCase.knownBadSuggestions) {
        const found = finalCandidates.find((c) => c.appid === bad.appid);
        if (found) {
          console.log(`  ❌ Wrongly included: ${bad.name}`);
        } else {
          console.log(`  ✓ Excluded: ${bad.name}`);
        }
      }
    }
  }
}

testApproachD().catch(console.error);
