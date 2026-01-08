import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText, embed, embedMany } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEST_GAMES = [4037180, 2475490, 3098700];

type GameData = {
  appid: number;
  title: string;
  short_description: string | null;
  steamspy_tags: Record<string, number> | null;
};

type Architecture = {
  name: string;
  description: string;
  generateSummary: (game: GameData) => Promise<string>;
  findMatches: (summary: string, sourceAppid: number, candidates: GameData[]) => Promise<Match[]>;
};

type Match = {
  appid: number;
  title: string;
  score: number;
  reason: string;
};

type TestResult = {
  architecture: string;
  game: string;
  summaryMs: number;
  matchMs: number;
  totalMs: number;
  matchCount: number;
  topMatches: Match[];
};

async function fetchGame(appid: number): Promise<GameData | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, short_description, steamspy_tags")
    .eq("appid", appid)
    .single();
  return data;
}

async function fetchCandidates(excludeAppid: number, limit = 50): Promise<GameData[]> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, short_description, steamspy_tags")
    .neq("appid", excludeAppid)
    .not("short_description", "is", null)
    .limit(limit);
  return data || [];
}

const VIBE_SUMMARY_PROMPT = `Analyze this game and create a SPECIFIC profile. Be concrete, not abstract.

Title: {title}
Description: {description}
Tags: {tags}

Output these fields in this exact format:
- PERSPECTIVE: (first-person, third-person, top-down, side-scroller, etc.)
- TONE: (horror, cozy, tense, comedic, melancholic, etc. - pick 1-2 specific words)
- PACING: (slow-burn, frantic, methodical, etc.)
- AESTHETIC: (lo-fi, pixel art, realistic, stylized, retro, etc.)
- CORE LOOP: (exploration, survival, puzzle-solving, combat, management, etc.)
- PLAYER FANTASY: What does the player GET TO DO/BE? (one sentence)

Be specific. "Atmospheric" is useless. "Claustrophobic dread in confined spaces" is useful.`;

const MATCH_PROMPT = `You are matching games for a "similar games" recommendation.

SOURCE GAME PROFILE:
{summary}

CANDIDATES:
{descriptions}

A GOOD MATCH shares MULTIPLE of these with the source:
- Same perspective (first-person horror should match first-person horror, not top-down)
- Same tone (horror matches horror, not cozy exploration)
- Similar pacing (slow-burn matches slow-burn, not frantic action)
- Similar aesthetic (lo-fi matches lo-fi, not AAA realistic)
- Similar core loop (narrative horror matches narrative horror, not action combat)

A BAD MATCH shares only abstract themes like "space" or "existential" but differs in actual gameplay feel.

Example: Mouthwashing (first-person, psychological horror, slow-burn, lo-fi, narrative) should match Iron Lung or Signalis, NOT Outer Wilds (third-person, cozy wonder, exploration, stylized, puzzle).

Rate each game 1-10. Only include games scoring 7+.
Output JSON: [{"index": 1, "score": 8, "reason": "matching attributes"}]
JSON only, no other text.`;

function createLLMArchitecture(name: string, model: string): Architecture {
  return {
    name,
    description: `Generate vibe summary + LLM ranking with ${model}`,
    async generateSummary(game) {
      const { text } = await generateText({
        model,
        prompt: VIBE_SUMMARY_PROMPT
          .replace("{title}", game.title)
          .replace("{description}", game.short_description || "None")
          .replace("{tags}", game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"),
      });
      return text;
    },
    async findMatches(summary, sourceAppid, candidates) {
      const descriptions = candidates
        .map((c, i) => `${i + 1}. ${c.title}: ${c.short_description?.slice(0, 150)}`)
        .join("\n");

      const { text } = await generateText({
        model,
        prompt: MATCH_PROMPT
          .replace("{summary}", summary)
          .replace("{descriptions}", descriptions),
      });

      try {
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
        return parsed
          .filter((m: any) => m.score >= 7 && candidates[m.index - 1])
          .map((m: any) => ({
            appid: candidates[m.index - 1].appid,
            title: candidates[m.index - 1].title,
            score: m.score,
            reason: m.reason,
          }));
      } catch {
        return [];
      }
    },
  };
}

const ARCHITECTURES: Architecture[] = [
  createLLMArchitecture("A1: Claude Sonnet 4.5", "anthropic/claude-sonnet-4.5"),
  createLLMArchitecture("A2: Gemini 3 Flash", "google/gemini-3-flash"),
  createLLMArchitecture("A3: GPT-5 Mini", "openai/gpt-5-mini"),
  {
    name: "A4: Vibe Embedding + Cosine Similarity",
    description: "Embed vibe summary, find similar via cosine distance",
    async generateSummary(game) {
      const { text } = await generateText({
        model: "openai/gpt-5-mini",
        prompt: VIBE_SUMMARY_PROMPT
          .replace("{title}", game.title)
          .replace("{description}", game.short_description || "None")
          .replace("{tags}", game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"),
      });
      return text;
    },
    async findMatches(summary, sourceAppid, candidates) {
      const { embedding: sourceEmbed } = await embed({
        model: "openai/text-embedding-3-small",
        value: summary,
      });

      const candidateTexts = candidates.map(
        (c) => `${c.title}: ${c.short_description?.slice(0, 200) || ""}`
      );

      const { embeddings: candidateEmbeds } = await embedMany({
        model: "openai/text-embedding-3-small",
        values: candidateTexts,
      });

      const scores = candidateEmbeds.map((emb, i) => ({
        index: i,
        score: cosineSimilarity(sourceEmbed, emb),
      }));

      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .filter((s) => s.score > 0.3)
        .map((s) => ({
          appid: candidates[s.index].appid,
          title: candidates[s.index].title,
          score: Math.round(s.score * 10),
          reason: `${Math.round(s.score * 100)}% embedding similarity`,
        }));
    },
  },
  {
    name: "A5: Hybrid (Embedding Filter + LLM Rerank)",
    description: "Use embeddings to narrow candidates, then LLM for final ranking",
    async generateSummary(game) {
      const { text } = await generateText({
        model: "openai/gpt-5-mini",
        prompt: VIBE_SUMMARY_PROMPT
          .replace("{title}", game.title)
          .replace("{description}", game.short_description || "None")
          .replace("{tags}", game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"),
      });
      return text;
    },
    async findMatches(summary, sourceAppid, candidates) {
      const { embedding: sourceEmbed } = await embed({
        model: "openai/text-embedding-3-small",
        value: summary,
      });

      const candidateTexts = candidates.map(
        (c) => `${c.title}: ${c.short_description?.slice(0, 200) || ""}`
      );

      const { embeddings: candidateEmbeds } = await embedMany({
        model: "openai/text-embedding-3-small",
        values: candidateTexts,
      });

      const scores = candidateEmbeds.map((emb, i) => ({
        index: i,
        score: cosineSimilarity(sourceEmbed, emb),
      }));

      const topCandidates = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map((s) => candidates[s.index]);

      if (topCandidates.length === 0) return [];

      const descriptions = topCandidates
        .map((c, i) => `${i + 1}. ${c.title}: ${c.short_description?.slice(0, 150)}`)
        .join("\n");

      const { text } = await generateText({
        model: "openai/gpt-5-mini",
        prompt: MATCH_PROMPT
          .replace("{summary}", summary)
          .replace("{descriptions}", descriptions),
      });

      try {
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
        return parsed
          .filter((m: any) => m.score >= 7 && topCandidates[m.index - 1])
          .map((m: any) => ({
            appid: topCandidates[m.index - 1].appid,
            title: topCandidates[m.index - 1].title,
            score: m.score,
            reason: m.reason,
          }));
      } catch {
        return [];
      }
    },
  },
];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runTest(arch: Architecture, game: GameData, candidates: GameData[]): Promise<TestResult> {
  const summaryStart = Date.now();
  const summary = await arch.generateSummary(game);
  const summaryMs = Date.now() - summaryStart;

  const matchStart = Date.now();
  const matches = await arch.findMatches(summary, game.appid, candidates);
  const matchMs = Date.now() - matchStart;

  return {
    architecture: arch.name,
    game: game.title,
    summaryMs,
    matchMs,
    totalMs: summaryMs + matchMs,
    matchCount: matches.length,
    topMatches: matches.slice(0, 5),
  };
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("VIBE MATCHING ARCHITECTURE COMPARISON");
  console.log("=".repeat(80) + "\n");

  const results: TestResult[] = [];

  for (const appid of TEST_GAMES) {
    const game = await fetchGame(appid);
    if (!game) {
      console.log(`Game ${appid} not found, skipping`);
      continue;
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`TEST GAME: ${game.title}`);
    console.log(`Description: ${game.short_description?.slice(0, 100)}...`);
    console.log(`${"─".repeat(60)}\n`);

    const candidates = await fetchCandidates(appid, 50);

    for (const arch of ARCHITECTURES) {
      console.log(`Testing: ${arch.name}`);
      try {
        const result = await runTest(arch, game, candidates);
        results.push(result);

        console.log(`  Summary: ${result.summaryMs}ms | Match: ${result.matchMs}ms | Total: ${result.totalMs}ms`);
        console.log(`  Matches: ${result.matchCount}`);
        if (result.topMatches.length > 0) {
          console.log(`  Top 3:`);
          for (const m of result.topMatches.slice(0, 3)) {
            console.log(`    [${m.score}] ${m.title} - ${m.reason}`);
          }
        }
        console.log();
      } catch (err) {
        console.log(`  ERROR: ${err instanceof Error ? err.message : err}\n`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80) + "\n");

  const byArch = new Map<string, TestResult[]>();
  for (const r of results) {
    const arr = byArch.get(r.architecture) || [];
    arr.push(r);
    byArch.set(r.architecture, arr);
  }

  console.log("Architecture                                    | Avg Time | Avg Matches");
  console.log("-".repeat(75));
  for (const [arch, runs] of byArch) {
    const avgTime = Math.round(runs.reduce((s, r) => s + r.totalMs, 0) / runs.length);
    const avgMatches = (runs.reduce((s, r) => s + r.matchCount, 0) / runs.length).toFixed(1);
    console.log(`${arch.padEnd(47)} | ${(avgTime + "ms").padEnd(8)} | ${avgMatches}`);
  }
}

main().catch(console.error);
