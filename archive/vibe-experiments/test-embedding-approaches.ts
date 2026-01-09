import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText, embed } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Suggestion = { title: string; reason: string; appid?: number; similarity?: number };

const VIBE_SUMMARY_PROMPT = `Analyze this game and create a SPECIFIC profile. Be concrete, not abstract.

Title: {title}
Description: {description}
Tags: {tags}

Output these fields in this exact format (one line each, no extra text):
PERSPECTIVE: (first-person, third-person, top-down, side-scroller, isometric, etc.)
TONE: (horror, cozy, tense, comedic, melancholic, nihilistic, whimsical, etc.)
PACING: (slow-burn, frantic, methodical, relaxed, etc.)
AESTHETIC: (lo-fi, pixel art, realistic, stylized, PS1, hand-drawn, etc.)
CORE_LOOP: (exploration, survival, puzzle, combat, management, narrative, etc.)
FANTASY: (one sentence - what does the player GET TO DO/BE?)`;

async function ensureEmbedding(appid: number): Promise<boolean> {
  const { data: existing } = await supabase
    .from("game_vibes")
    .select("appid")
    .eq("appid", appid)
    .single();

  if (existing) return true;

  const { data: game } = await supabase
    .from("games_new")
    .select("title, short_description, steamspy_tags")
    .eq("appid", appid)
    .single();

  if (!game) return false;

  console.log(`Generating embedding for ${game.title}...`);

  const { text: summary } = await generateText({
    model: "openai/gpt-4.1-mini",
    prompt: VIBE_SUMMARY_PROMPT
      .replace("{title}", game.title)
      .replace("{description}", game.short_description || "None")
      .replace("{tags}", game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"),
  });

  const { embedding } = await embed({
    model: "openai/text-embedding-3-small",
    value: summary,
  });

  const { error } = await supabase.from("game_vibes").upsert({
    appid,
    vibe_summary: summary,
    vibe_embedding: embedding,
  });

  if (error) {
    console.log(`  Error: ${error.message}`);
    return false;
  }

  console.log(`  Done!\n`);
  return true;
}

async function getPerplexitySuggestions(game: string, desc: string, count: number): Promise<Suggestion[]> {
  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find ${count} indie games similar to "${game}" (${desc}).
Match on VIBE: perspective, tone, pacing, aesthetic, core loop.
Prioritize lesser-known indie games over mainstream titles.
Write SHORT friendly reasons (under 15 words).
Return ONLY JSON: [{"title":"Game","reason":"Why similar"}]`,
  });

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]).map((s: any) => ({
        title: s.title,
        reason: s.reason?.replace(/\[\d+\]/g, "").trim(),
      }));
    }
  } catch {}
  return [];
}

async function getEmbeddingSuggestions(appid: number, count: number): Promise<Suggestion[]> {
  const { data, error } = await supabase.rpc("find_similar_vibes", {
    source_appid: appid,
    match_count: count,
    similarity_threshold: 0.3,
  });

  if (error || !data) return [];

  return data.map((d: any) => ({
    title: d.title,
    reason: `${Math.round(d.similarity * 100)}% vibe match`,
    appid: d.appid,
    similarity: d.similarity,
  }));
}

async function resolveToDb(title: string): Promise<{ appid: number; title: string } | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title")
    .ilike("title", `%${title}%`)
    .limit(1)
    .single();
  return data;
}

async function getEmbeddingSimilarity(sourceAppid: number, targetAppid: number): Promise<number | null> {
  const { data } = await supabase.rpc("find_similar_vibes", {
    source_appid: sourceAppid,
    match_count: 100,
    similarity_threshold: 0.0,
  });

  const match = data?.find((d: any) => d.appid === targetAppid);
  return match?.similarity ?? null;
}

async function approach1_perplexityOnly(appid: number, title: string, desc: string) {
  const start = Date.now();
  const suggestions = await getPerplexitySuggestions(title, desc, 8);
  
  const resolved = await Promise.all(
    suggestions.map(async (s) => {
      const db = await resolveToDb(s.title);
      return db ? { ...s, appid: db.appid, title: db.title } : s;
    })
  );

  return { suggestions: resolved.filter(s => s.appid), elapsed: Date.now() - start };
}

async function approach2_embeddingOnly(appid: number) {
  const start = Date.now();
  const suggestions = await getEmbeddingSuggestions(appid, 8);
  return { suggestions, elapsed: Date.now() - start };
}

async function approach3_perplexityWithEmbeddingRerank(appid: number, title: string, desc: string) {
  const start = Date.now();
  
  const perplexity = await getPerplexitySuggestions(title, desc, 15);
  
  const resolved = await Promise.all(
    perplexity.map(async (s) => {
      const db = await resolveToDb(s.title);
      if (!db) return null;
      const similarity = await getEmbeddingSimilarity(appid, db.appid);
      return { ...s, appid: db.appid, title: db.title, similarity };
    })
  );

  const valid = resolved.filter((s): s is NonNullable<typeof s> => s !== null && s.similarity !== null);
  const sorted = valid.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, 8);

  return { suggestions: sorted, elapsed: Date.now() - start };
}

async function approach4_twoSourceMerge(appid: number, title: string, desc: string) {
  const start = Date.now();

  const [perplexity, embeddings] = await Promise.all([
    getPerplexitySuggestions(title, desc, 5),
    getEmbeddingSuggestions(appid, 5),
  ]);

  const resolvedPerplexity = await Promise.all(
    perplexity.map(async (s) => {
      const db = await resolveToDb(s.title);
      return db ? { ...s, appid: db.appid, title: db.title, source: "perplexity" } : null;
    })
  );

  const embeddingsWithSource = embeddings.map(s => ({ ...s, source: "embedding" }));
  
  const validPerplexity = resolvedPerplexity.filter((s): s is NonNullable<typeof s> => s !== null);
  const all = [...validPerplexity, ...embeddingsWithSource];
  const seen = new Set<number>();
  const deduped = all.filter((s) => {
    if (!s.appid || seen.has(s.appid)) return false;
    seen.add(s.appid);
    return true;
  });

  return { suggestions: deduped.slice(0, 8), elapsed: Date.now() - start };
}

async function approach5_embeddingFallback(appid: number, title: string, desc: string) {
  const start = Date.now();

  const { count } = await supabase
    .from("game_vibes")
    .select("*", { count: "exact", head: true })
    .eq("appid", appid);

  if (count && count > 0) {
    const suggestions = await getEmbeddingSuggestions(appid, 8);
    return { suggestions, elapsed: Date.now() - start, source: "embedding" };
  }

  const perplexity = await getPerplexitySuggestions(title, desc, 8);
  const resolved = await Promise.all(
    perplexity.map(async (s) => {
      const db = await resolveToDb(s.title);
      return db ? { ...s, appid: db.appid, title: db.title } : s;
    })
  );

  return { suggestions: resolved.filter(s => s.appid), elapsed: Date.now() - start, source: "perplexity" };
}

async function main() {
  console.log("=".repeat(70));
  console.log("EMBEDDING APPROACH COMPARISON");
  console.log("=".repeat(70));

  const { count } = await supabase
    .from("game_vibes")
    .select("*", { count: "exact", head: true });
  console.log(`\nGames with embeddings: ${count}\n`);

  const testGame = { appid: 2475490, title: "Mouthwashing", desc: "Five crew members stranded in space" };

  console.log(`Test game: ${testGame.title} (${testGame.appid})\n`);

  const hasEmbedding = await ensureEmbedding(testGame.appid);
  if (!hasEmbedding) {
    console.log("Failed to create embedding for test game");
    return;
  }

  const approaches = [
    { name: "1. Perplexity only", fn: () => approach1_perplexityOnly(testGame.appid, testGame.title, testGame.desc) },
    { name: "2. Embedding only", fn: () => approach2_embeddingOnly(testGame.appid) },
    { name: "3. Perplexity + Embedding rerank", fn: () => approach3_perplexityWithEmbeddingRerank(testGame.appid, testGame.title, testGame.desc) },
    { name: "4. Two-source merge", fn: () => approach4_twoSourceMerge(testGame.appid, testGame.title, testGame.desc) },
    { name: "5. Embedding fallback", fn: () => approach5_embeddingFallback(testGame.appid, testGame.title, testGame.desc) },
  ];

  for (const { name, fn } of approaches) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(name);
    console.log("─".repeat(60));

    try {
      const result = await fn();
      console.log(`Time: ${result.elapsed}ms | Results: ${result.suggestions.length}`);
      if ("source" in result) console.log(`Source: ${result.source}`);
      
      console.log("\nTop suggestions:");
      for (const s of result.suggestions.slice(0, 5)) {
        const sim = s.similarity ? ` [${Math.round(s.similarity * 100)}%]` : "";
        const src = (s as any).source ? ` (${(s as any).source})` : "";
        console.log(`  • ${s.title}${sim}${src}`);
        console.log(`    "${s.reason}"`);
      }
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));
}

main().catch(console.error);
