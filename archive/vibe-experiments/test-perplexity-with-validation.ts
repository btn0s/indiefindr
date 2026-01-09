import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

const TEST_GAMES = ["Mouthwashing", "Hades", "Celeste"];

type Suggestion = {
  title: string;
  reason: string;
  appid?: number;
  steam_title?: string;
  validated: boolean;
};

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

async function getSuggestionsWithValidation(game: string): Promise<{
  suggestions: Suggestion[];
  timing: { perplexity: number; validation: number; total: number };
}> {
  const perplexityStart = Date.now();

  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find 10 indie games similar to "${game}".

For each game, write a SHORT (under 15 words) user-friendly explanation of why it's similar. Write as if recommending to a friend.

Return ONLY valid JSON:
[{"title":"Game Name","reason":"Short friendly reason"}]`,
  });

  const perplexityTime = Date.now() - perplexityStart;

  let suggestions: Suggestion[] = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0]).map((s: any) => ({
        title: s.title,
        reason: s.reason?.replace(/\[\d+\]/g, "").trim(),
        validated: false,
      }));
    }
  } catch {
    return { suggestions: [], timing: { perplexity: perplexityTime, validation: 0, total: perplexityTime } };
  }

  const validationStart = Date.now();

  const validationPromises = suggestions.map(async (s) => {
    const result = await searchSteam(s.title);
    if (result) {
      s.appid = result.appid;
      s.steam_title = result.name;
      s.validated = true;
    }
    return s;
  });

  await Promise.all(validationPromises);

  const validationTime = Date.now() - validationStart;

  return {
    suggestions,
    timing: {
      perplexity: perplexityTime,
      validation: validationTime,
      total: perplexityTime + validationTime,
    },
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("PERPLEXITY + STEAM VALIDATION TEST");
  console.log("=".repeat(70));

  const allTimings: { perplexity: number; validation: number; total: number }[] = [];

  for (const game of TEST_GAMES) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`GAME: ${game}`);
    console.log(`${"─".repeat(70)}`);

    const { suggestions, timing } = await getSuggestionsWithValidation(game);
    allTimings.push(timing);

    console.log(`\nTiming: Perplexity ${timing.perplexity}ms + Validation ${timing.validation}ms = ${timing.total}ms`);

    const validated = suggestions.filter((s) => s.validated);
    const failed = suggestions.filter((s) => !s.validated);

    console.log(`\nValidated (${validated.length}/${suggestions.length}):`);
    for (const s of validated) {
      const match = s.title.toLowerCase() === s.steam_title?.toLowerCase() ? "✓" : "~";
      console.log(`  ${match} ${s.title} → ${s.steam_title} (${s.appid})`);
      console.log(`    "${s.reason}"`);
    }

    if (failed.length > 0) {
      console.log(`\nFailed validation (${failed.length}):`);
      for (const s of failed) {
        console.log(`  ✗ ${s.title}`);
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));

  const avgPerplexity = Math.round(allTimings.reduce((s, t) => s + t.perplexity, 0) / allTimings.length);
  const avgValidation = Math.round(allTimings.reduce((s, t) => s + t.validation, 0) / allTimings.length);
  const avgTotal = Math.round(allTimings.reduce((s, t) => s + t.total, 0) / allTimings.length);

  console.log(`\nAverage timing:`);
  console.log(`  Perplexity: ${avgPerplexity}ms`);
  console.log(`  Validation: ${avgValidation}ms`);
  console.log(`  Total:      ${avgTotal}ms`);
}

main().catch(console.error);
