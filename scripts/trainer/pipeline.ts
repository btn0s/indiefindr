#!/usr/bin/env npx tsx

/**
 * Full trainer pipeline: backfill tags → mine co-reviews → refresh pairs → run agents → train → materialize.
 *
 * Each stage is idempotent. Targets local dev by default; --env prod targets production
 * using env vars already exported in the shell.
 *
 * Usage:
 *   npx tsx scripts/trainer/pipeline.ts                           # all stages (local)
 *   npx tsx scripts/trainer/pipeline.ts --env prod                # all stages (prod)
 *   npx tsx scripts/trainer/pipeline.ts --stage tags              # just backfill tags
 *   npx tsx scripts/trainer/pipeline.ts --env prod --stage mine   # just mine co-reviews
 *   npx tsx scripts/trainer/pipeline.ts --stage tags,mine,train   # specific stages
 *   npx tsx scripts/trainer/pipeline.ts --stage agents --screens 50 --budget 1.00
 *   npx tsx scripts/trainer/pipeline.ts --stage train --epochs 50
 */

import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { generateText } from "ai";
import { fetchSteamSpyData } from "../../src/lib/utils/steamspy";
import { calculateTagSimilarity } from "../../src/lib/utils/steamspy";

const args = process.argv.slice(2);

function strArg(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

function numArg(name: string, fallback: number): number {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= args.length) return fallback;
  const parsed = parseFloat(args[i + 1]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const ENV = strArg("env", "local");
const STAGES_ARG = strArg("stage", "all");
const SCREENS = numArg("screens", 20);
const BUDGET_USD = numArg("budget", 0.5);
const EPOCHS = numArg("epochs", 30);
const AGENT_MODEL = strArg("model", "openai/gpt-4o-mini");
const MINE_LIMIT = numArg("limit", 50);
const MINE_PAGES = numArg("pages", 3);
const MINE_DELAY_MS = numArg("delay", 1500);

const ALL_STAGES = ["tags", "mine", "pairs", "agents", "train", "materialize"] as const;
type Stage = (typeof ALL_STAGES)[number];

const stages: Stage[] =
  STAGES_ARG === "all"
    ? [...ALL_STAGES]
    : STAGES_ARG.split(",").map((s) => {
        if (!ALL_STAGES.includes(s as Stage)) {
          console.error(`Unknown stage: ${s}. Available: ${ALL_STAGES.join(", ")}`);
          process.exit(1);
        }
        return s as Stage;
      });

if (ENV === "local") {
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    config({ path: envPath });
    console.log(`Loaded ${envPath}`);
  }
} else {
  console.log("Targeting production — expecting env vars in shell");
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing: ${missing.join(", ")}`);
    console.error("Export them first:");
    console.error("  export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co");
    console.error("  export SUPABASE_SERVICE_ROLE_KEY=eyJ...");
    process.exit(1);
  }
}

function getClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── TAGS ────────────────────────────────────────────────────────────

async function backfillTags(): Promise<void> {
  const supabase = getClient();
  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title, steamspy_tags")
    .order("appid", { ascending: true })
    .limit(10000);

  if (error || !games) {
    console.error("Failed to fetch catalog:", error?.message);
    return;
  }

  const needsTags = games.filter(
    (g: { steamspy_tags: Record<string, number> | null }) =>
      !g.steamspy_tags || Object.keys(g.steamspy_tags).length === 0
  );
  console.log(`${needsTags.length} / ${games.length} games need tags`);

  let ok = 0;
  let skip = 0;
  for (const game of needsTags) {
    const data = await fetchSteamSpyData(game.appid);
    if (data && Object.keys(data.tags).length > 0) {
      const { error: e } = await supabase
        .from("games_new")
        .update({
          steamspy_tags: data.tags,
          steamspy_positive: data.positive,
          steamspy_negative: data.negative,
          steamspy_owners: data.owners,
        })
        .eq("appid", game.appid);
      if (e) console.error(`  FAIL: ${game.appid} ${e.message}`);
      else {
        ok++;
        console.log(`  OK: ${game.appid} ${game.title} (${Object.keys(data.tags).length} tags)`);
      }
    } else {
      skip++;
      console.log(`  SKIP: ${game.appid} ${game.title}`);
    }
    await sleep(1200);
  }
  console.log(`Tags done: ${ok} updated, ${skip} skipped`);
}

// ─── MINE ────────────────────────────────────────────────────────────

function hashReviewer(steamid: string): string {
  return createHash("sha256").update(steamid).digest("hex").slice(0, 16);
}

async function mineCoreviews(): Promise<void> {
  const supabase = getClient();
  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title")
    .order("appid", { ascending: true })
    .limit(10000);

  if (error || !games) {
    console.error("Failed to fetch catalog:", error?.message);
    return;
  }

  const { data: existing } = await supabase
    .from("steam_review_edges")
    .select("appid")
    .limit(100000);
  const crawled = new Set((existing ?? []).map((r: { appid: number }) => r.appid));
  const todo = games.filter((g: { appid: number }) => !crawled.has(g.appid)).slice(0, MINE_LIMIT);

  console.log(`Catalog: ${games.length} games, ${crawled.size} crawled, mining ${todo.length}`);

  let totalEdges = 0;
  for (let i = 0; i < todo.length; i++) {
    const game = todo[i] as { appid: number; title: string };
    const hashes = new Set<string>();
    let cursor = "*";

    for (let page = 0; page < MINE_PAGES; page++) {
      const url =
        `https://store.steampowered.com/appreviews/${game.appid}` +
        `?json=1&filter=recent&language=all&purchase_type=all` +
        `&num_per_page=100&cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = (await res.json()) as {
        cursor?: string;
        reviews?: Array<{ author?: { steamid?: string } }>;
      };
      for (const r of data.reviews ?? []) {
        const sid = r.author?.steamid;
        if (sid) hashes.add(hashReviewer(sid));
      }
      if (!data.cursor || data.cursor === cursor || (data.reviews?.length ?? 0) < 100) break;
      cursor = data.cursor;
      await sleep(MINE_DELAY_MS);
    }

    if (hashes.size > 0) {
      const rows = Array.from(hashes).map((h) => ({ appid: game.appid, reviewer_hash: h }));
      const { error: e } = await supabase
        .from("steam_review_edges")
        .upsert(rows, { onConflict: "appid,reviewer_hash", ignoreDuplicates: true });
      if (e) console.error(`  FAIL: ${game.appid} ${e.message}`);
      else {
        totalEdges += rows.length;
        console.log(`  [${i + 1}/${todo.length}] ${game.title} +${rows.length} edges`);
      }
    } else {
      console.log(`  [${i + 1}/${todo.length}] ${game.title} — no reviews`);
    }
    if (i < todo.length - 1) await sleep(MINE_DELAY_MS);
  }
  console.log(`Mining done: ${totalEdges} edges written`);
}

// ─── PAIRS ───────────────────────────────────────────────────────────

async function refreshCoreviewPairs(): Promise<void> {
  const supabase = getClient();
  const { data: inserted, error } = await supabase.rpc("refresh_coreview_pairs", {
    min_coreviews: 3,
  });
  if (error) {
    console.error("refresh_coreview_pairs failed:", error.message);
    return;
  }
  console.log(`Inserted ${inserted} co-review pairs.`);
}

// ─── AGENTS ──────────────────────────────────────────────────────────

const PERSONAS: Record<string, string> = {
  "indie-generalist":
    "You play a wide range of indie games and judge similarity by overall feel: tone, pacing, and what kind of evening the game is for.",
  "cozy-player":
    "You play relaxing, low-stress games. Two games are similar only if they share that gentle, comforting quality — mechanics matter less than mood.",
  "mechanics-purist":
    "You care about gameplay systems above all. Two games are similar only if their core loops and skill demands genuinely overlap; ignore theme and art style.",
  "art-game-connoisseur":
    "You seek experimental, unconventional games. Similarity means shared artistic ambition and strangeness, not genre labels.",
  "narrative-lover":
    "You play for story and characters. Similarity means comparable emotional journeys and writing quality.",
};

type AgentAnswer = { picked: number[]; rejected: number[] };

async function runAgents(): Promise<void> {
  const supabase = getClient();
  const personaIds = Object.keys(PERSONAS);
  const PRICE_IN = 0.15 / 1_000_000;
  const PRICE_OUT = 0.6 / 1_000_000;
  let spent = 0;
  let saved = 0;
  let failed = 0;

  const sessionIds = new Map<string, string>();

  for (let i = 0; i < SCREENS; i++) {
    if (spent >= BUDGET_USD) {
      console.log(`Budget reached ($${spent.toFixed(4)}), stopping.`);
      break;
    }

    const personaId = personaIds[i % personaIds.length];

    const { data: taggedGames } = await supabase
      .from("games_new")
      .select("appid")
      .not("steamspy_tags", "is", null)
      .limit(10000);
    if (!taggedGames || taggedGames.length < 32) {
      console.error("Not enough tagged games for agent screens");
      break;
    }

    const pool = taggedGames.map((g: { appid: number }) => g.appid);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const seedId = shuffled[0];
    const candidateIds = shuffled.slice(1, 9);

    const { data: seedRow } = await supabase
      .from("games_new")
      .select("appid, title, short_description, steamspy_tags")
      .eq("appid", seedId)
      .single();
    if (!seedRow) continue;

    const { data: candidateRows } = await supabase
      .from("games_new")
      .select("appid, title, short_description, steamspy_tags")
      .in("appid", candidateIds);
    if (!candidateRows || candidateRows.length === 0) continue;

    const seedTags = Object.entries(seedRow.steamspy_tags ?? {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([t]) => t);

    const candidateList = candidateRows
      .map(
        (c: { appid: number; title: string; short_description: string | null; steamspy_tags: Record<string, number> | null }) => {
          const tags = Object.entries(c.steamspy_tags ?? {})
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([t]) => t);
          return `- appid ${c.appid}: "${c.title}" | tags: ${tags.join(", ") || "none"} | ${(c.short_description ?? "").slice(0, 200)}`;
        }
      )
      .join("\n");

    const facet = Math.random() < 0.2 ? (Math.random() < 0.5 ? "vibe" : "mechanics") : null;
    const question = facet === "vibe"
      ? "Which candidates FEEL like the seed game (tone, mood, atmosphere)?"
      : facet === "mechanics"
        ? "Which candidates PLAY like the seed game (core loop, systems)?"
        : "Which candidates are genuinely similar to the seed game?";

    const prompt = `You are labeling game similarity. Persona: ${PERSONAS[personaId]}

SEED: "${seedRow.title}"
Tags: ${seedTags.join(", ") || "none"}
Description: ${(seedRow.short_description ?? "").slice(0, 400)}

CANDIDATES:
${candidateList}

QUESTION: ${question}

Rules:
- "picked": candidates a player who loves the seed would also enjoy for the SAME reasons.
- "rejected": candidates that would clearly disappoint that player. Leave out anything you're unsure about.
- It is fine to pick none.

Return ONLY JSON: {"picked":[appids],"rejected":[appids]}`;

    try {
      const start = Date.now();
      const result = await generateText({ model: AGENT_MODEL, prompt });
      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      spent += inputTokens * PRICE_IN + outputTokens * PRICE_OUT;

      const shown = new Set(candidateRows.map((c: { appid: number }) => c.appid));
      const match = result.text.match(/\{[\s\S]*\}/);
      if (!match) { failed++; continue; }

      const parsed = JSON.parse(match[0]) as { picked?: unknown; rejected?: unknown };
      const clamp = (v: unknown): number[] =>
        Array.isArray(v)
          ? v.map((x) => (typeof x === "number" ? x : parseInt(String(x), 10))).filter((x) => Number.isInteger(x) && shown.has(x))
          : [];
      const picked = clamp(parsed.picked);
      const rejectedRaw = clamp(parsed.rejected).filter((x) => !new Set(picked).has(x));

      let sessionId = sessionIds.get(personaId);
      if (!sessionId) {
        const { data: session, error: se } = await supabase
          .from("judgment_sessions")
          .insert({ source: "agent", agent_model: AGENT_MODEL, persona_id: personaId })
          .select("id")
          .single();
        if (se || !session) { failed++; continue; }
        sessionId = session.id as string;
        sessionIds.set(personaId, sessionId);
      }

      const { error: je } = await supabase.from("similarity_judgments").insert({
        session_id: sessionId,
        seed_appid: seedId,
        shown_appids: candidateRows.map((c: { appid: number }) => c.appid),
        picked_appids: picked,
        rejected_appids: rejectedRaw,
        best_appid: null,
        facet,
        sampler_version: "pipeline-agents-v1",
        latency_ms: Date.now() - start,
      });

      if (je) { failed++; console.error(`  FAIL: ${je.message}`); }
      else {
        saved++;
        console.log(`  [${i + 1}/${SCREENS}] ${personaId}: seed "${seedRow.title}" → ${picked.length} picked, ${rejectedRaw.length} rejected ($${spent.toFixed(4)})`);
      }
    } catch (err) {
      failed++;
      console.error(`  [${i + 1}/${SCREENS}] ${personaId}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Agents done: ${saved} saved, ${failed} failed, ~$${spent.toFixed(4)} spent`);
}

// ─── TRAIN ───────────────────────────────────────────────────────────

async function train(): Promise<void> {
  const supabase = getClient();
  const { data: judgments, error } = await supabase
    .from("similarity_judgments")
    .select("seed_appid, shown_appids, picked_appids, rejected_appids, facet, judgment_sessions(source)")
    .limit(50000);
  if (error || !judgments || judgments.length === 0) {
    console.error("No judgments found. Run agents or use /trainer first.");
    return;
  }

  type JRow = {
    seed_appid: number;
    shown_appids: number[];
    picked_appids: number[];
    rejected_appids: number[];
    judgment_sessions: { source: string } | null;
  };

  const appids = Array.from(
    new Set((judgments as unknown as JRow[]).flatMap((j) => [j.seed_appid, ...j.shown_appids]))
  );
  const { data: gameRows } = await supabase
    .from("games_new")
    .select("appid, title, steamspy_tags, developers, steamspy_positive, steamspy_negative, steamspy_owners")
    .in("appid", appids);

  type GameFeatures = {
    appid: number;
    tags: Record<string, number>;
    developers: string[];
    reviewRatio: number;
    logOwners: number;
  };

  function parseOwners(s: string | null): number {
    if (!s) return 0;
    const nums = s.match(/[\d,]+/g)?.map((n) => parseInt(n.replace(/,/g, ""), 10)) ?? [];
    return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] ?? 0;
  }

  const games = new Map<number, GameFeatures>();
  for (const r of gameRows ?? []) {
    const p = r.steamspy_positive ?? 0;
    const n = r.steamspy_negative ?? 0;
    games.set(r.appid, {
      appid: r.appid,
      tags: r.steamspy_tags ?? {},
      developers: r.developers ?? [],
      reviewRatio: p + n > 0 ? p / (p + n) : 0.5,
      logOwners: Math.log10(parseOwners(r.steamspy_owners as string | null) + 1),
    });
  }

  const FEATURE_NAMES = ["tag_similarity", "shared_tag_count", "same_developer", "review_ratio", "popularity_gap", "vibe_conflict"];
  const HUMAN_WEIGHT = 1;
  const AGENT_WEIGHT = 0.3;
  const REJECTED_WEIGHT = 2;
  const L2 = 1e-4;
  const LR = 0.05;

  function featureVec(seed: GameFeatures, cand: GameFeatures): number[] {
    const { score, sharedTags, vibeConflict } = calculateTagSimilarity(seed.tags, cand.tags);
    const seedDevs = new Set(seed.developers.map((d) => d.toLowerCase()));
    const sameDev = cand.developers.some((d) => seedDevs.has(d.toLowerCase())) ? 1 : 0;
    const popGap = Math.min(Math.abs(seed.logOwners - cand.logOwners) / 4, 1);
    return [score, Math.min(sharedTags.length / 10, 1), sameDev, cand.reviewRatio, popGap, vibeConflict ? 1 : 0];
  }

  function hashSeed(appid: number): number {
    let h = appid;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return h >>> 0;
  }

  type Pair = { seed: number; positive: number; negative: number; weight: number };
  const train: Pair[] = [];
  const holdout: Pair[] = [];

  for (const j of judgments as unknown as JRow[]) {
    if (!games.has(j.seed_appid)) continue;
    const srcW = j.judgment_sessions?.source === "human" ? HUMAN_WEIGHT : AGENT_WEIGHT;
    const picked = new Set(j.picked_appids);
    const positives = j.picked_appids.filter((a) => games.has(a));
    const negatives = j.shown_appids
      .filter((a) => !picked.has(a) && games.has(a))
      .map((a) => ({ appid: a, weight: (j.rejected_appids.includes(a) ? REJECTED_WEIGHT : 1) * srcW }));
    if (positives.length === 0 || negatives.length === 0) continue;

    const pairs: Pair[] = [];
    for (const p of positives) for (const n of negatives) pairs.push({ seed: j.seed_appid, positive: p, negative: n.appid, weight: n.weight });
    pairs.sort(() => Math.random() - 0.5);

    const bucket = hashSeed(j.seed_appid) % 100 < 20 ? holdout : train;
    bucket.push(...pairs.slice(0, 40));
  }

  console.log(`Pairs: ${train.length} train / ${holdout.length} holdout`);
  if (train.length < 50) { console.error("Not enough pairs to train."); return; }

  const weights = new Array(FEATURE_NAMES.length).fill(0);
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
  const dot = (w: number[], f: number[]) => w.reduce((s, wi, i) => s + wi * f[i], 0);

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    train.sort(() => Math.random() - 0.5);
    let loss = 0;
    for (const p of train) {
      const fp = featureVec(games.get(p.seed)!, games.get(p.positive)!);
      const fn = featureVec(games.get(p.seed)!, games.get(p.negative)!);
      const margin = dot(weights, fp) - dot(weights, fn);
      const gradScale = p.weight * (sigmoid(margin) - 1);
      loss += -Math.log(Math.max(sigmoid(margin), 1e-12)) * p.weight;
      for (let k = 0; k < weights.length; k++) weights[k] -= LR * (gradScale * (fp[k] - fn[k]) + L2 * weights[k]);
    }
    if ((epoch + 1) % 10 === 0) console.log(`  epoch ${epoch + 1}/${EPOCHS}: loss ${(loss / train.length).toFixed(4)}`);
  }

  const accuracy = (pairs: Pair[]) => {
    if (pairs.length === 0) return 0;
    let c = 0;
    for (const p of pairs) {
      if (dot(weights, featureVec(games.get(p.seed)!, games.get(p.positive)!)) > dot(weights, featureVec(games.get(p.seed)!, games.get(p.negative)!))) c++;
    }
    return c / pairs.length;
  };

  console.log(`\nResults:`);
  console.log(`  train accuracy:      ${(accuracy(train) * 100).toFixed(1)}%`);
  console.log(`  holdout accuracy:    ${(accuracy(holdout) * 100).toFixed(1)}%`);
  console.log(`\nWeights:`);
  FEATURE_NAMES.forEach((n, i) => console.log(`  ${n.padEnd(24)} ${weights[i].toFixed(4)}`));

  const { mkdirSync, writeFileSync } = await import("node:fs");
  const artifactDir = resolve(__dirname, "artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = resolve(artifactDir, `weights-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(artifactPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    featureNames: FEATURE_NAMES,
    weights,
    config: { epochs: EPOCHS, lr: LR, humanWeight: HUMAN_WEIGHT, agentWeight: AGENT_WEIGHT, rejectedWeight: REJECTED_WEIGHT },
    data: { judgments: judgments.length, trainPairs: train.length, holdoutPairs: holdout.length },
    metrics: { trainAccuracy: accuracy(train), holdoutAccuracy: accuracy(holdout) },
  }, null, 2));
  console.log(`\nArtifact: ${artifactPath}`);

  if (ENV === "prod") {
    const { error: ue } = await supabase
      .from("games_new")
      .update({ suggested_game_appids: null })
      .not("steamspy_tags", "is", null);
    if (ue) console.error("Failed to clear old suggestions:", ue.message);
    else console.log("Cleared old suggestions for re-materialization");
  }
}

// ─── MATERIALIZE ─────────────────────────────────────────────────────

async function materialize(): Promise<void> {
  const supabase = getClient();

  const { readdirSync, readFileSync } = await import("node:fs");
  const artifactDir = resolve(__dirname, "artifacts");
  let weights: number[] = [1.0, 0.3, 0.5, 0.1, -0.1, -2.0];
  try {
    const files = readdirSync(artifactDir).filter((f) => f.startsWith("weights-")).sort();
    if (files.length > 0) {
      const latest = JSON.parse(readFileSync(resolve(artifactDir, files[files.length - 1]), "utf-8"));
      weights = latest.weights;
      console.log(`Loaded weights from ${files[files.length - 1]}`);
    }
  } catch {}

  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title, steamspy_tags, developers, steamspy_positive, steamspy_negative, steamspy_owners")
    .not("steamspy_tags", "is", null)
    .order("appid", { ascending: true })
    .limit(10000);

  if (error || !games) { console.error("Failed to fetch catalog:", error?.message); return; }
  console.log(`Materializing suggestions for ${games.length} games...`);

  const FEATURE_NAMES = ["tag_similarity", "shared_tag_count", "same_developer", "review_ratio", "popularity_gap", "vibe_conflict"];

  function parseOwners(s: string | null): number {
    if (!s) return 0;
    const nums = s.match(/[\d,]+/g)?.map((n) => parseInt(n.replace(/,/g, ""), 10)) ?? [];
    return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] ?? 0;
  }

  type GF = { appid: number; tags: Record<string, number>; developers: string[]; reviewRatio: number; logOwners: number; title: string };
  const gameMap = new Map<number, GF>();
  for (const r of games) {
    const p = r.steamspy_positive ?? 0;
    const n = r.steamspy_negative ?? 0;
    gameMap.set(r.appid, {
      appid: r.appid, title: r.title, tags: r.steamspy_tags ?? {}, developers: r.developers ?? [],
      reviewRatio: p + n > 0 ? p / (p + n) : 0.5,
      logOwners: Math.log10(parseOwners(r.steamspy_owners as string | null) + 1),
    });
  }

  const dot = (w: number[], f: number[]) => w.reduce((s, wi, i) => s + wi * f[i], 0);

  let done = 0;
  let skipped = 0;
  for (const seed of games) {
    const { data: existing } = await supabase
      .from("game_suggestions")
      .select("id")
      .eq("source_appid", seed.appid)
      .limit(1);
    if (existing && existing.length > 0) { skipped++; continue; }

    const seedG = gameMap.get(seed.appid);
    if (!seedG) continue;

    const scored: { appid: number; title: string; score: number; sharedTags: string[]; vibeConflict: boolean; sameDeveloper: boolean }[] = [];
    for (const [candId, cand] of gameMap) {
      if (candId === seed.appid) continue;
      const { score, sharedTags, vibeConflict } = calculateTagSimilarity(seedG.tags, cand.tags);
      if (vibeConflict) continue;
      const seedDevs = new Set(seedG.developers.map((d) => d.toLowerCase()));
      const sameDev = cand.developers.some((d) => seedDevs.has(d.toLowerCase())) ? 1 : 0;
      const popGap = Math.min(Math.abs(seedG.logOwners - cand.logOwners) / 4, 1);
      const features = [score, Math.min(sharedTags.length / 10, 1), sameDev, cand.reviewRatio, popGap, 0];
      scored.push({ appid: candId, title: cand.title, score: dot(weights, features), sharedTags, vibeConflict, sameDeveloper: !!sameDev });
    }
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 12);
    if (top.length === 0) continue;

    const rows = top.map((c) => {
      const parts: string[] = [];
      if (c.sameDeveloper) parts.push("Same developer");
      if (c.sharedTags.length > 0) parts.push(`Similar ${c.sharedTags.slice(0, 3).join(", ")}`);
      if (parts.length === 0) parts.push(`Fans of ${seedG.title} also enjoy this`);
      return { source_appid: seed.appid, suggested_appid: c.appid, reason: parts.join(" · ") };
    });

    const { error: e } = await supabase.from("game_suggestions").insert(rows);
    if (e) console.error(`  FAIL: ${seed.appid} ${e.message}`);
    else { done++; console.log(`  OK: ${seed.appid} ${seed.title} — ${rows.length} suggestions`); }
  }
  console.log(`Materialize done: ${done} games, ${skipped} already had suggestions`);
}

// ─── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Pipeline: env=${ENV}, stages=[${stages.join(", ")}]`);
  for (const stage of stages) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`STAGE: ${stage}`);
    console.log("=".repeat(60));
    switch (stage) {
      case "tags": await backfillTags(); break;
      case "mine": await mineCoreviews(); break;
      case "pairs": await refreshCoreviewPairs(); break;
      case "agents": await runAgents(); break;
      case "train": await train(); break;
      case "materialize": await materialize(); break;
    }
  }
  console.log("\nPipeline complete.");
}

main().catch(console.error);
