import { getSupabaseServiceClient } from "../supabase/service";
import { calculateTagSimilarity, getTopTags } from "../utils/steamspy";
import type {
  TrainerCandidate,
  TrainerFacet,
  TrainerGame,
  TrainerScreen,
} from "./types";

export const SAMPLER_VERSION = "tags-v1";

const SCREEN_SIZE = 8;
const TOP_PICKS = 3;
const NEAR_PICKS = 3;
const RANDOM_PICKS = SCREEN_SIZE - TOP_PICKS - NEAR_PICKS;
const CANDIDATE_SAMPLE = 160;
const FACET_SCREEN_RATE = 0.2;
const MIN_SEED_TAGS = 1;
const MIN_CANDIDATE_TAGS = 0;

type GameRow = {
  appid: number;
  title: string;
  header_image: string | null;
  short_description: string | null;
  steamspy_tags: Record<string, number> | null;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function toTrainerGame(row: GameRow): TrainerGame {
  return {
    appid: row.appid,
    title: row.title,
    header_image: row.header_image,
    short_description: row.short_description,
    topTags: getTopTags(row.steamspy_tags ?? {}, 5),
  };
}

async function fetchTaggedAppids(): Promise<number[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("games_new")
    .select("appid")
    .not("steamspy_tags", "is", null)
    .limit(10000);

  if (error) throw new Error(`Failed to fetch appid pool: ${error.message}`);
  return (data ?? []).map((row: { appid: number }) => row.appid);
}

async function fetchGames(appids: number[]): Promise<GameRow[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("games_new")
    .select("appid, title, header_image, short_description, steamspy_tags")
    .in("appid", appids);

  if (error) throw new Error(`Failed to fetch games: ${error.message}`);
  return (data ?? []) as GameRow[];
}

async function pickSeed(pool: number[], seedAppid?: number): Promise<GameRow> {
  if (seedAppid) {
    const [seed] = await fetchGames([seedAppid]);
    if (!seed) throw new Error(`Seed game ${seedAppid} not found`);
    return seed;
  }

  // Sample a handful and keep the first with enough tags to score against
  const sampled = shuffle(pool).slice(0, 20);
  const rows = await fetchGames(sampled);
  const eligible = rows.find(
    (row) => Object.keys(row.steamspy_tags ?? {}).length >= MIN_SEED_TAGS
  );
  if (!eligible) {
    throw new Error(
      "No seed candidates with enough tags — run the steamspy tag backfill first"
    );
  }
  return eligible;
}

/**
 * Build one labeling screen: a seed game plus a deliberate mix of candidates —
 * top tag-similarity picks, near misses (hard cases), and popularity-agnostic
 * random picks for exploration coverage.
 */
export async function buildTrainerScreen(seedAppid?: number): Promise<TrainerScreen> {
  const pool = await fetchTaggedAppids();
  if (pool.length < SCREEN_SIZE * 4) {
    throw new Error(
      `Catalog too small for trainer screens (${pool.length} tagged games)`
    );
  }

  const seed = await pickSeed(pool, seedAppid);

  const sampleIds = shuffle(pool.filter((id) => id !== seed.appid)).slice(
    0,
    CANDIDATE_SAMPLE
  );
  const rows = await fetchGames(sampleIds);

  const scored = rows
    .filter((row) => Object.keys(row.steamspy_tags ?? {}).length >= MIN_CANDIDATE_TAGS)
    .map((row) => ({
      row,
      score: calculateTagSimilarity(seed.steamspy_tags ?? {}, row.steamspy_tags ?? {})
        .score,
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length < SCREEN_SIZE * 2) {
    throw new Error("Not enough tagged candidates to build a screen");
  }

  const top = scored.slice(0, TOP_PICKS);
  const nearPool = scored.slice(TOP_PICKS, Math.min(40, scored.length - RANDOM_PICKS));
  const near = shuffle(nearPool).slice(0, NEAR_PICKS);

  const used = new Set([...top, ...near].map((entry) => entry.row.appid));
  const randomPool = scored.filter((entry) => !used.has(entry.row.appid));
  const random = shuffle(randomPool).slice(0, RANDOM_PICKS);

  const candidates: TrainerCandidate[] = shuffle([
    ...top.map((entry) => ({ ...toTrainerGame(entry.row), slot: "top" as const })),
    ...near.map((entry) => ({ ...toTrainerGame(entry.row), slot: "near" as const })),
    ...random.map((entry) => ({ ...toTrainerGame(entry.row), slot: "random" as const })),
  ]);

  let facet: TrainerFacet | null = null;
  if (Math.random() < FACET_SCREEN_RATE) {
    facet = Math.random() < 0.5 ? "vibe" : "mechanics";
  }

  return {
    seed: toTrainerGame(seed),
    candidates,
    facet,
    samplerVersion: SAMPLER_VERSION,
  };
}
