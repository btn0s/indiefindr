#!/usr/bin/env npx tsx

/**
 * Fit a linear similarity scorer on collected judgments (BPR / triplet loss).
 *
 * Reads similarity_judgments, builds (seed, picked, not-picked) preference
 * pairs, fits a weight vector over cheap content features, and writes a
 * versioned JSON artifact with train/holdout pairwise accuracy. The split is
 * by seed game, so holdout numbers reflect unseen seeds.
 *
 * Usage:
 *   npx tsx scripts/trainer/train.ts [--epochs 30] [--lr 0.05] [--human-weight 1] [--agent-weight 0.3]
 */

import { config } from "dotenv";
config({ path: [".env.local"] });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getSupabaseServiceClient } from "../../src/lib/supabase/service";
import { calculateTagSimilarity } from "../../src/lib/utils/steamspy";

const args = process.argv.slice(2);

function numArg(name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return fallback;
  const parsed = parseFloat(args[index + 1]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const EPOCHS = numArg("epochs", 30);
const LEARNING_RATE = numArg("lr", 0.05);
const HUMAN_WEIGHT = numArg("human-weight", 1);
const AGENT_WEIGHT = numArg("agent-weight", 0.3);
const REJECTED_WEIGHT = 2; // explicit "definitely not" is a stronger negative
const L2 = 1e-4;
const MAX_PAIRS_PER_JUDGMENT = 40;
const HOLDOUT_FRACTION = 0.2;

const FEATURE_NAMES = [
  "tag_similarity",
  "shared_tag_count",
  "same_developer",
  "candidate_review_ratio",
  "popularity_gap",
  "vibe_conflict",
] as const;

type GameFeatures = {
  appid: number;
  tags: Record<string, number>;
  developers: string[];
  reviewRatio: number;
  logOwners: number;
};

type JudgmentRow = {
  seed_appid: number;
  shown_appids: number[];
  picked_appids: number[];
  rejected_appids: number[];
  facet: string | null;
  judgment_sessions: { source: string } | null;
};

type Pair = {
  seed: number;
  positive: number;
  negative: number;
  weight: number;
};

function parseOwnersMid(owners: string | null): number {
  if (!owners) return 0;
  const numbers = owners.match(/[\d,]+/g)?.map((n) => parseInt(n.replace(/,/g, ""), 10));
  if (!numbers || numbers.length === 0) return 0;
  return numbers.length >= 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
}

function featureVector(seed: GameFeatures, candidate: GameFeatures): number[] {
  const { score, sharedTags, vibeConflict } = calculateTagSimilarity(
    seed.tags,
    candidate.tags
  );
  const seedDevs = new Set(seed.developers.map((d) => d.toLowerCase()));
  const sameDev = candidate.developers.some((d) => seedDevs.has(d.toLowerCase()))
    ? 1
    : 0;
  const popularityGap = Math.min(
    Math.abs(seed.logOwners - candidate.logOwners) / 4,
    1
  );

  return [
    score,
    Math.min(sharedTags.length / 10, 1),
    sameDev,
    candidate.reviewRatio,
    popularityGap,
    vibeConflict ? 1 : 0,
  ];
}

function dot(weights: number[], features: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i] * features[i];
  return sum;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function hashSeed(appid: number): number {
  let h = appid;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return h >>> 0;
}

async function fetchJudgments(): Promise<JudgmentRow[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("similarity_judgments")
    .select(
      "seed_appid, shown_appids, picked_appids, rejected_appids, facet, judgment_sessions(source)"
    )
    .limit(50000);

  if (error) throw new Error(`Failed to fetch judgments: ${error.message}`);
  return (data ?? []) as unknown as JudgmentRow[];
}

async function fetchGameFeatures(appids: number[]): Promise<Map<number, GameFeatures>> {
  const supabase = getSupabaseServiceClient();
  const result = new Map<number, GameFeatures>();

  for (let i = 0; i < appids.length; i += 200) {
    const chunk = appids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("games_new")
      .select(
        "appid, steamspy_tags, developers, steamspy_positive, steamspy_negative, steamspy_owners"
      )
      .in("appid", chunk);

    if (error) throw new Error(`Failed to fetch game features: ${error.message}`);

    for (const row of data ?? []) {
      const positive = row.steamspy_positive ?? 0;
      const negative = row.steamspy_negative ?? 0;
      result.set(row.appid, {
        appid: row.appid,
        tags: row.steamspy_tags ?? {},
        developers: row.developers ?? [],
        reviewRatio: positive + negative > 0 ? positive / (positive + negative) : 0.5,
        logOwners: Math.log10(parseOwnersMid(row.steamspy_owners) + 1),
      });
    }
  }

  return result;
}

function buildPairs(
  judgments: JudgmentRow[],
  games: Map<number, GameFeatures>
): { train: Pair[]; holdout: Pair[] } {
  const train: Pair[] = [];
  const holdout: Pair[] = [];

  for (const judgment of judgments) {
    if (!games.has(judgment.seed_appid)) continue;

    const sourceWeight =
      judgment.judgment_sessions?.source === "human" ? HUMAN_WEIGHT : AGENT_WEIGHT;
    const picked = new Set(judgment.picked_appids);
    const rejected = new Set(judgment.rejected_appids);

    const positives = judgment.picked_appids.filter((appid) => games.has(appid));
    const negatives = judgment.shown_appids
      .filter((appid) => !picked.has(appid) && games.has(appid))
      .map((appid) => ({
        appid,
        weight: (rejected.has(appid) ? REJECTED_WEIGHT : 1) * sourceWeight,
      }));

    if (positives.length === 0 || negatives.length === 0) continue;

    const pairs: Pair[] = [];
    for (const positive of positives) {
      for (const negative of negatives) {
        pairs.push({
          seed: judgment.seed_appid,
          positive,
          negative: negative.appid,
          weight: negative.weight,
        });
      }
    }
    shuffleInPlace(pairs);

    const bucket = hashSeed(judgment.seed_appid) % 100 < HOLDOUT_FRACTION * 100 ? holdout : train;
    bucket.push(...pairs.slice(0, MAX_PAIRS_PER_JUDGMENT));
  }

  return { train, holdout };
}

function pairwiseAccuracy(
  weights: number[],
  pairs: Pair[],
  games: Map<number, GameFeatures>
): number {
  if (pairs.length === 0) return 0;
  let correct = 0;
  for (const pair of pairs) {
    const seed = games.get(pair.seed)!;
    const fp = featureVector(seed, games.get(pair.positive)!);
    const fn = featureVector(seed, games.get(pair.negative)!);
    if (dot(weights, fp) > dot(weights, fn)) correct++;
  }
  return correct / pairs.length;
}

async function main() {
  console.log("Loading judgments...");
  const judgments = await fetchJudgments();
  if (judgments.length === 0) {
    console.log(
      "No judgments yet. Collect some via /trainer or scripts/trainer/run-agents.ts first."
    );
    return;
  }

  const appids = Array.from(
    new Set(
      judgments.flatMap((j) => [j.seed_appid, ...j.shown_appids])
    )
  );
  console.log(`${judgments.length} judgments over ${appids.length} games. Loading features...`);
  const games = await fetchGameFeatures(appids);

  const { train, holdout } = buildPairs(judgments, games);
  console.log(`Pairs: ${train.length} train / ${holdout.length} holdout (split by seed)`);
  if (train.length < 50) {
    console.log("Not enough training pairs to fit anything meaningful yet.");
    return;
  }

  const weights = new Array<number>(FEATURE_NAMES.length).fill(0);
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    shuffleInPlace(train);
    let loss = 0;
    for (const pair of train) {
      const seed = games.get(pair.seed)!;
      const fp = featureVector(seed, games.get(pair.positive)!);
      const fn = featureVector(seed, games.get(pair.negative)!);
      const margin = dot(weights, fp) - dot(weights, fn);
      const gradScale = pair.weight * (sigmoid(margin) - 1); // d(-log σ(margin))/d(margin)
      loss += -Math.log(Math.max(sigmoid(margin), 1e-12)) * pair.weight;
      for (let k = 0; k < weights.length; k++) {
        weights[k] -=
          LEARNING_RATE * (gradScale * (fp[k] - fn[k]) + L2 * weights[k]);
      }
    }
    if ((epoch + 1) % 10 === 0 || epoch === 0) {
      console.log(
        `  epoch ${epoch + 1}/${EPOCHS}: loss ${(loss / train.length).toFixed(4)}`
      );
    }
  }

  const trainAccuracy = pairwiseAccuracy(weights, train, games);
  const holdoutAccuracy = pairwiseAccuracy(weights, holdout, games);
  // Reference: tag similarity alone (the E1-style baseline)
  const tagOnly = FEATURE_NAMES.map((name) => (name === "tag_similarity" ? 1 : 0));
  const tagOnlyHoldout = pairwiseAccuracy(tagOnly, holdout, games);

  console.log("\nResults:");
  console.log(`  train pairwise accuracy:   ${(trainAccuracy * 100).toFixed(1)}%`);
  console.log(`  holdout pairwise accuracy: ${(holdoutAccuracy * 100).toFixed(1)}%`);
  console.log(`  tag-sim-only holdout:      ${(tagOnlyHoldout * 100).toFixed(1)}%`);
  console.log("\nWeights:");
  FEATURE_NAMES.forEach((name, i) => {
    console.log(`  ${name.padEnd(24)} ${weights[i].toFixed(4)}`);
  });

  const artifactDir = path.join(__dirname, "artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(
    artifactDir,
    `weights-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        featureNames: FEATURE_NAMES,
        weights,
        config: {
          epochs: EPOCHS,
          learningRate: LEARNING_RATE,
          humanWeight: HUMAN_WEIGHT,
          agentWeight: AGENT_WEIGHT,
          rejectedWeight: REJECTED_WEIGHT,
          l2: L2,
        },
        data: {
          judgments: judgments.length,
          trainPairs: train.length,
          holdoutPairs: holdout.length,
        },
        metrics: {
          trainAccuracy,
          holdoutAccuracy,
          tagSimilarityOnlyHoldoutAccuracy: tagOnlyHoldout,
        },
      },
      null,
      2
    )
  );
  console.log(`\nArtifact written: ${artifactPath}`);
}

void main();
