import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Suggestion = {
  title: string;
  reason: string;
  appid?: number;
  source: "perplexity" | "db" | "steam_search";
};

async function searchOurDb(title: string): Promise<{ appid: number; title: string; description: string } | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, short_description")
    .ilike("title", `%${title}%`)
    .limit(1)
    .single();

  if (data) {
    return { appid: data.appid, title: data.title, description: data.short_description || "" };
  }
  return null;
}

async function searchSteam(query: string): Promise<{ appid: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`
    );
    const results = await res.json();
    if (results && results.length > 0) {
      return { appid: parseInt(results[0].appid), name: results[0].name };
    }
    return null;
  } catch {
    return null;
  }
}

async function generateReasonFromDb(
  sourceGame: { title: string; description: string },
  matchGame: { title: string; description: string }
): Promise<string> {
  const { text } = await generateText({
    model: "openai/gpt-4.1-mini",
    prompt: `Write ONE short sentence (under 15 words) explaining why "${matchGame.title}" is similar to "${sourceGame.title}".

Source: ${sourceGame.description?.slice(0, 200)}
Match: ${matchGame.description?.slice(0, 200)}

Write casually, like recommending to a friend. No marketing speak.`,
  });
  return text.replace(/^["']|["']$/g, "").trim();
}

async function getHybridSuggestions(gameTitle: string): Promise<{
  suggestions: Suggestion[];
  timing: { perplexity: number; dbLookup: number; steamFallback: number; reasonGen: number; total: number };
}> {
  const totalStart = Date.now();
  
  const sourceGame = await searchOurDb(gameTitle);
  const sourceDesc = sourceGame?.description || "";

  const perplexityStart = Date.now();
  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find 10 indie games similar to "${gameTitle}". Return ONLY game titles as JSON array: ["Game 1", "Game 2", ...]`,
  });
  const perplexityTime = Date.now() - perplexityStart;

  let titles: string[] = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      titles = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return { suggestions: [], timing: { perplexity: perplexityTime, dbLookup: 0, steamFallback: 0, reasonGen: 0, total: Date.now() - totalStart } };
  }

  const suggestions: Suggestion[] = [];
  let dbLookupTime = 0;
  let steamFallbackTime = 0;
  let reasonGenTime = 0;

  const dbLookupStart = Date.now();
  const dbResults = await Promise.all(titles.map(t => searchOurDb(t)));
  dbLookupTime = Date.now() - dbLookupStart;

  const needsSteam = titles.filter((_, i) => !dbResults[i]);
  const steamFallbackStart = Date.now();
  const steamResults = await Promise.all(needsSteam.map(t => searchSteam(t)));
  steamFallbackTime = Date.now() - steamFallbackStart;

  let steamIdx = 0;
  const reasonGenStart = Date.now();
  
  const dbGames = titles
    .map((title, i) => ({ title, dbResult: dbResults[i] }))
    .filter((x): x is { title: string; dbResult: NonNullable<typeof dbResults[0]> } => x.dbResult !== null);

  const reasonPromises = dbGames.map(({ dbResult }) =>
    generateReasonFromDb(
      { title: gameTitle, description: sourceDesc },
      { title: dbResult.title, description: dbResult.description }
    )
  );

  const reasons = await Promise.all(reasonPromises);
  reasonGenTime = Date.now() - reasonGenStart;

  for (let i = 0; i < dbGames.length; i++) {
    const { dbResult } = dbGames[i];
    suggestions.push({
      title: dbResult.title,
      reason: reasons[i],
      appid: dbResult.appid,
      source: "db",
    });
  }

  for (let i = 0; i < titles.length; i++) {
    if (!dbResults[i]) {
      const steamResult = steamResults[steamIdx++];
      if (steamResult) {
        suggestions.push({
          title: steamResult.name,
          reason: "(from web search)",
          appid: steamResult.appid,
          source: "steam_search",
        });
      }
    }
  }

  return {
    suggestions,
    timing: {
      perplexity: perplexityTime,
      dbLookup: dbLookupTime,
      steamFallback: steamFallbackTime,
      reasonGen: reasonGenTime,
      total: Date.now() - totalStart,
    },
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("HYBRID SUGGESTIONS TEST (DB first, Steam fallback)");
  console.log("=".repeat(70));

  const testGames = ["Mouthwashing", "Hades"];

  for (const game of testGames) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`GAME: ${game}`);
    console.log(`${"─".repeat(70)}`);

    const { suggestions, timing } = await getHybridSuggestions(game);

    console.log(`\nTiming breakdown:`);
    console.log(`  Perplexity (titles only): ${timing.perplexity}ms`);
    console.log(`  DB lookup (parallel):     ${timing.dbLookup}ms`);
    console.log(`  Steam fallback:           ${timing.steamFallback}ms`);
    console.log(`  Reason generation:        ${timing.reasonGen}ms`);
    console.log(`  TOTAL:                    ${timing.total}ms`);

    const fromDb = suggestions.filter(s => s.source === "db");
    const fromSteam = suggestions.filter(s => s.source === "steam_search");

    console.log(`\nFrom DB (${fromDb.length}) - with generated reasons:`);
    for (const s of fromDb) {
      console.log(`  ✓ ${s.title} (${s.appid})`);
      console.log(`    "${s.reason}"`);
    }

    if (fromSteam.length > 0) {
      console.log(`\nFrom Steam search (${fromSteam.length}) - no reason:`);
      for (const s of fromSteam) {
        console.log(`  ~ ${s.title} (${s.appid})`);
      }
    }
  }
}

main().catch(console.error);
