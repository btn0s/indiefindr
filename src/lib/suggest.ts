import { getSupabaseServiceClient } from "./supabase/service";
import {
  calculateTagSimilarity,
} from "./utils/steamspy";
import { Suggestion } from "./supabase/types";
import { SUGGESTION_CONFIG } from "./config";

export type SuggestResult = {
  suggestions: Suggestion[];
  stats: {
    catalogSize: number;
    candidatesScored: number;
    filtered: number;
  };
};

type GameRow = {
  appid: number;
  title: string;
  steamspy_tags: Record<string, number> | null;
  developers: string[] | null;
  steamspy_positive: number | null;
  steamspy_negative: number | null;
  steamspy_owners: string | null;
};

type ScoredCandidate = {
  appid: number;
  title: string;
  score: number;
  sharedTags: string[];
  vibeConflict: boolean;
  sameDeveloper: boolean;
};

function parseOwnersMid(owners: string | null): number {
  if (!owners) return 0;
  const numbers = owners
    .match(/[\d,]+/g)
    ?.map((n) => parseInt(n.replace(/,/g, ""), 10));
  if (!numbers || numbers.length === 0) return 0;
  return numbers.length >= 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
}

function buildReason(candidate: ScoredCandidate, seedTitle: string): string {
  const parts: string[] = [];

  if (candidate.sameDeveloper) {
    parts.push("Same developer");
  }

  if (candidate.sharedTags.length > 0) {
    const tags = candidate.sharedTags.slice(0, 3).join(", ");
    parts.push(`Similar ${tags}`);
  }

  if (parts.length === 0) {
    parts.push(`Fans of ${seedTitle} also enjoy this`);
  }

  return parts.join(" · ");
}

function scoreCandidate(
  seed: GameRow,
  candidate: GameRow,
  weights: number[]
): ScoredCandidate {
  const { score, sharedTags, vibeConflict } = calculateTagSimilarity(
    seed.steamspy_tags ?? {},
    candidate.steamspy_tags ?? {}
  );

  const seedDevs = new Set((seed.developers ?? []).map((d) => d.toLowerCase()));
  const sameDeveloper = (candidate.developers ?? []).some((d) =>
    seedDevs.has(d.toLowerCase())
  );

  const seedLogOwners = Math.log10(parseOwnersMid(seed.steamspy_owners) + 1);
  const candLogOwners = Math.log10(parseOwnersMid(candidate.steamspy_owners) + 1);
  const popularityGap = Math.min(Math.abs(seedLogOwners - candLogOwners) / 4, 1);

  const positive = candidate.steamspy_positive ?? 0;
  const negative = candidate.steamspy_negative ?? 0;
  const reviewRatio = positive + negative > 0 ? positive / (positive + negative) : 0.5;

  const features = [
    score,
    Math.min(sharedTags.length / 10, 1),
    sameDeveloper ? 1 : 0,
    reviewRatio,
    popularityGap,
    vibeConflict ? 1 : 0,
  ];

  let finalScore = 0;
  for (let i = 0; i < features.length; i++) {
    finalScore += (weights[i] ?? 0) * features[i];
  }

  return {
    appid: candidate.appid,
    title: candidate.title,
    score: finalScore,
    sharedTags,
    vibeConflict,
    sameDeveloper,
  };
}

const DEFAULT_WEIGHTS = [1.0, 0.3, 0.5, 0.1, -0.1, -2.0];

export async function suggestGames(
  seedAppid: number,
  count: number = SUGGESTION_CONFIG.TARGET_SUGGESTION_COUNT,
  weights: number[] = DEFAULT_WEIGHTS
): Promise<SuggestResult> {
  const supabase = getSupabaseServiceClient();

  const { data: seedRow, error: seedError } = await supabase
    .from("games_new")
    .select(
      "appid, title, steamspy_tags, developers, steamspy_positive, steamspy_negative, steamspy_owners"
    )
    .eq("appid", seedAppid)
    .single();

  if (seedError || !seedRow) {
    return { suggestions: [], stats: { catalogSize: 0, candidatesScored: 0, filtered: 0 } };
  }

  const seed = seedRow as GameRow;

  const { data: catalog, error: catalogError } = await supabase
    .from("games_new")
    .select(
      "appid, title, steamspy_tags, developers, steamspy_positive, steamspy_negative, steamspy_owners"
    )
    .not("steamspy_tags", "is", null)
    .neq("appid", seedAppid)
    .limit(5000);

  if (catalogError || !catalog || catalog.length === 0) {
    return {
      suggestions: [],
      stats: { catalogSize: 0, candidatesScored: 0, filtered: 0 },
    };
  }

  const scored = catalog
    .map((row) => scoreCandidate(seed, row as GameRow, weights))
    .filter((c) => !c.vibeConflict)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, count);

  const suggestions: Suggestion[] = top.map((c) => ({
    appId: c.appid,
    title: c.title,
    explanation: buildReason(c, seed.title),
    category: c.sameDeveloper ? ("same-developer" as const) : ("niche" as const),
  }));

  return {
    suggestions,
    stats: {
      catalogSize: catalog.length,
      candidatesScored: catalog.length,
      filtered: scored.length - top.length,
    },
  };
}
