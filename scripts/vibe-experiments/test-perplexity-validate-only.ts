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
  source: "db" | "steam" | "unverified";
};

async function searchDb(title: string): Promise<{ appid: number; title: string } | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title")
    .ilike("title", `%${title}%`)
    .limit(1)
    .single();
  return data ? { appid: data.appid, title: data.title } : null;
}

async function searchSteam(query: string): Promise<{ appid: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`
    );
    const results = await res.json();
    return results?.[0] ? { appid: parseInt(results[0].appid), name: results[0].name } : null;
  } catch {
    return null;
  }
}

async function getSuggestions(gameTitle: string): Promise<{
  suggestions: Suggestion[];
  timing: { perplexity: number; validation: number; total: number };
}> {
  const start = Date.now();

  const perplexityStart = Date.now();
  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find 10 indie games similar to "${gameTitle}".
Write SHORT (under 15 words) friendly reasons. Return ONLY JSON:
[{"title":"Game","reason":"Why similar"}]`,
  });
  const perplexityTime = Date.now() - perplexityStart;

  let raw: { title: string; reason: string }[] = [];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) raw = JSON.parse(match[0]);
  } catch {
    return { suggestions: [], timing: { perplexity: perplexityTime, validation: 0, total: Date.now() - start } };
  }

  const validationStart = Date.now();

  const validated = await Promise.all(
    raw.map(async ({ title, reason }): Promise<Suggestion> => {
      const cleanReason = reason.replace(/\[\d+\]/g, "").trim();

      const dbResult = await searchDb(title);
      if (dbResult) {
        return { title: dbResult.title, reason: cleanReason, appid: dbResult.appid, source: "db" };
      }

      const steamResult = await searchSteam(title);
      if (steamResult) {
        return { title: steamResult.name, reason: cleanReason, appid: steamResult.appid, source: "steam" };
      }

      return { title, reason: cleanReason, source: "unverified" };
    })
  );

  const validationTime = Date.now() - validationStart;

  return {
    suggestions: validated,
    timing: { perplexity: perplexityTime, validation: validationTime, total: Date.now() - start },
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("PERPLEXITY + VALIDATE ONLY (no reason regeneration)");
  console.log("=".repeat(70));

  for (const game of ["Mouthwashing", "Hades", "Celeste"]) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`GAME: ${game}`);
    console.log(`${"─".repeat(70)}`);

    const { suggestions, timing } = await getSuggestions(game);

    console.log(`\nTiming: Perplexity ${timing.perplexity}ms + Validation ${timing.validation}ms = ${timing.total}ms`);

    const bySource = { db: 0, steam: 0, unverified: 0 };
    for (const s of suggestions) bySource[s.source]++;

    console.log(`Sources: DB=${bySource.db}, Steam=${bySource.steam}, Unverified=${bySource.unverified}\n`);

    for (const s of suggestions) {
      const icon = s.source === "db" ? "✓" : s.source === "steam" ? "~" : "?";
      const id = s.appid ? `(${s.appid})` : "";
      console.log(`${icon} ${s.title} ${id}`);
      console.log(`  "${s.reason}"`);
    }
  }
}

main().catch(console.error);
