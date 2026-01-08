import { fetchSteamSpyGame, fetchGamesByTag, getTopTags } from "./steamspy-client";

const STEAMSPY_DELAY = 1100;
const STEAM_DELAY = 2000;
const BATCH_SIZE = 100;

type EnrichedGame = {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  tags: Record<string, number>;
  owners: string;
  positive: number;
  negative: number;
  comingSoon: boolean;
};

const enrichedGames = new Map<number, EnrichedGame>();
const processedTags = new Set<string>();
const queue: number[] = [];

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichGame(appid: number): Promise<EnrichedGame | null> {
  if (enrichedGames.has(appid)) {
    return enrichedGames.get(appid)!;
  }

  const data = await fetchSteamSpyGame(appid);
  if (!data || !data.name) return null;

  const enriched: EnrichedGame = {
    appid: data.appid,
    name: data.name,
    developer: data.developer,
    publisher: data.publisher,
    tags: data.tags,
    owners: data.owners,
    positive: data.positive,
    negative: data.negative,
    comingSoon: false,
  };

  enrichedGames.set(appid, enriched);
  return enriched;
}

async function discoverGamesFromTag(tag: string): Promise<number[]> {
  if (processedTags.has(tag)) return [];
  processedTags.add(tag);

  console.log(`[DISCOVER] Fetching games with tag: ${tag}`);
  const games = await fetchGamesByTag(tag);
  return games.map((g) => g.appid).filter((id) => !enrichedGames.has(id));
}

async function runEnrichmentWorker(seedAppids: number[], targetCount = 500): Promise<void> {
  console.log("=== ENRICHMENT WORKER ===");
  console.log(`Target: ${targetCount} enriched games`);
  console.log(`Seed games: ${seedAppids.length}`);
  console.log("");

  queue.push(...seedAppids);

  const startTime = Date.now();
  let processed = 0;

  while (enrichedGames.size < targetCount && (queue.length > 0 || processed < seedAppids.length)) {
    const appid = queue.shift();
    if (!appid) {
      console.log("[WORKER] Queue empty, waiting for more discoveries...");
      await sleep(5000);
      continue;
    }

    if (enrichedGames.has(appid)) continue;

    console.log(`[${enrichedGames.size}/${targetCount}] Enriching ${appid}...`);
    const game = await enrichGame(appid);
    processed++;

    if (game && Object.keys(game.tags).length > 0) {
      const topTags = getTopTags(game.tags, 3);
      for (const tag of topTags) {
        if (!processedTags.has(tag) && processedTags.size < 20) {
          const newAppids = await discoverGamesFromTag(tag);
          queue.push(...newAppids.slice(0, 50));
          console.log(`  [+${newAppids.length} games from "${tag}"]`);
        }
      }
    }

    if (processed % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const eta = (targetCount - enrichedGames.size) / rate;
      console.log(`\n[STATS] ${enrichedGames.size} enriched, ${queue.length} queued, ${rate.toFixed(1)}/sec, ETA: ${(eta / 60).toFixed(1)}min\n`);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log("\n=== ENRICHMENT COMPLETE ===");
  console.log(`Total enriched: ${enrichedGames.size}`);
  console.log(`Time: ${(elapsed / 60).toFixed(1)} minutes`);
  console.log(`Tags discovered: ${processedTags.size}`);

  printStats();
}

function printStats(): void {
  const games = Array.from(enrichedGames.values());

  const byOwnerTier = {
    tiny: games.filter((g) => parseOwners(g.owners) < 50000),
    niche: games.filter((g) => {
      const o = parseOwners(g.owners);
      return o >= 50000 && o < 200000;
    }),
    mid: games.filter((g) => {
      const o = parseOwners(g.owners);
      return o >= 200000 && o < 500000;
    }),
    popular: games.filter((g) => parseOwners(g.owners) >= 500000),
  };

  console.log("\n=== BREAKDOWN BY OWNERS ===");
  console.log(`Tiny (<50k):     ${byOwnerTier.tiny.length}`);
  console.log(`Niche (50-200k): ${byOwnerTier.niche.length}`);
  console.log(`Mid (200-500k):  ${byOwnerTier.mid.length}`);
  console.log(`Popular (>500k): ${byOwnerTier.popular.length}`);

  const allTags = new Map<string, number>();
  for (const game of games) {
    for (const [tag, count] of Object.entries(game.tags)) {
      allTags.set(tag, (allTags.get(tag) || 0) + 1);
    }
  }

  const topTags = Array.from(allTags.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log("\n=== TOP TAGS IN CACHE ===");
  for (const [tag, count] of topTags) {
    console.log(`${tag}: ${count} games`);
  }
}

function parseOwners(owners: string): number {
  const match = owners.match(/^([\d,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

async function findSimilarFromCache(
  sourceAppid: number,
  limit = 12
): Promise<{ niche: EnrichedGame[]; classics: EnrichedGame[]; sameDev: EnrichedGame[] }> {
  const source = enrichedGames.get(sourceAppid);
  if (!source) {
    return { niche: [], classics: [], sameDev: [] };
  }

  const sourceTags = new Set(getTopTags(source.tags, 10).map((t) => t.toLowerCase()));
  const results: Array<{ game: EnrichedGame; score: number }> = [];

  for (const game of enrichedGames.values()) {
    if (game.appid === sourceAppid) continue;

    const gameTags = getTopTags(game.tags, 10);
    const shared = gameTags.filter((t) => sourceTags.has(t.toLowerCase()));
    const score = shared.length / Math.max(sourceTags.size, 1);

    if (score >= 0.2) {
      results.push({ game, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  const sameDev = results
    .filter((r) => r.game.developer === source.developer && r.game.developer !== "")
    .map((r) => r.game);

  const niche = results
    .filter((r) => parseOwners(r.game.owners) < 200000 && !sameDev.includes(r.game))
    .slice(0, limit)
    .map((r) => r.game);

  const classics = results
    .filter((r) => parseOwners(r.game.owners) >= 500000 && !sameDev.includes(r.game))
    .slice(0, limit)
    .map((r) => r.game);

  return { sameDev, niche, classics };
}

const SEED_APPIDS = [
  2475490,  // Mouthwashing
  1262350,  // SIGNALIS
  881100,   // Noita
  1145360,  // Hades
  588650,   // Dead Cells
  250900,   // Binding of Isaac Rebirth
  367520,   // Hollow Knight
  413150,   // Stardew Valley
  1150690,  // OMORI
  814380,   // Sekiro
];

async function main() {
  console.log("Starting enrichment with seed games...\n");

  await runEnrichmentWorker(SEED_APPIDS, 100);

  console.log("\n\n=== TESTING SIMILARITY SEARCH FROM CACHE ===\n");

  const mouthwashing = 2475490;
  console.log("Finding similar games to Mouthwashing from cache...");
  const similar = await findSimilarFromCache(mouthwashing, 5);

  console.log("\nSame Developer:");
  for (const g of similar.sameDev) {
    console.log(`  - ${g.name} (${g.owners})`);
  }

  console.log("\nNiche (<200k owners):");
  for (const g of similar.niche) {
    console.log(`  - ${g.name} (${g.owners})`);
  }

  console.log("\nClassics (>500k owners):");
  for (const g of similar.classics) {
    console.log(`  - ${g.name} (${g.owners})`);
  }
}

main().catch(console.error);
