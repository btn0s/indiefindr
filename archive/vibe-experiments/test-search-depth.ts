#!/usr/bin/env npx tsx

/**
 * HYPOTHESIS: Requesting more results (15-20) then filtering down to 10
 * produces better quality than requesting exactly 10.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

async function searchWithCount(
  game: string,
  desc: string,
  count: number
): Promise<{ suggestions: any[]; elapsed: number; error?: string }> {
  const start = Date.now();
  
  const prompt = `Find ${count} indie games similar to "${game}" (${desc}).

Match the core loop, vibe, tone, and aesthetic.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return { suggestions: [], elapsed: Date.now() - start, error: "No JSON found" };
    }

    const parsed = JSON.parse(match[0]);
    return { suggestions: parsed, elapsed: Date.now() - start };
  } catch (err) {
    return { suggestions: [], elapsed: Date.now() - start, error: String(err) };
  }
}

async function filterWithAI(
  game: string,
  desc: string,
  suggestions: any[]
): Promise<any[]> {
  const suggestionsList = suggestions
    .map((s, i) => `${i + 1}. "${s.title}" - ${s.reason}`)
    .join("\n");

  const prompt = `You are curating game recommendations for "${game}" (${desc}).

Here are ${suggestions.length} candidate suggestions:

${suggestionsList}

Select the TOP 10 most relevant matches. Prioritize games that truly match the gameplay and vibe.

Return ONLY valid JSON: [{"title":"Game Name","reason":"Why"}]`;

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]).slice(0, 10);
  } catch (err) {
    console.error("Filtering failed:", err);
    return [];
  }
}

async function testGame(game: string, desc: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${game}`);
  console.log("=".repeat(70));

  // Test different counts
  const counts = [10, 15, 20];
  
  console.log("\n⚡ Searching with different counts...");
  const results = await Promise.all(
    counts.map(count => searchWithCount(game, desc, count))
  );

  console.log("\nRaw results:");
  counts.forEach((count, i) => {
    const r = results[i];
    if (r.error) {
      console.log(`  ❌ Count ${count}: ${r.error}`);
    } else {
      console.log(`  ✅ Count ${count}: ${r.suggestions.length} actual suggestions (${r.elapsed}ms)`);
    }
  });

  // For 15 and 20 count results, filter down to 10
  console.log("\n🤖 Filtering longer lists to top 10...");
  
  const filtered15 = results[1].suggestions.length > 0 
    ? await filterWithAI(game, desc, results[1].suggestions)
    : [];
  
  const filtered20 = results[2].suggestions.length > 0
    ? await filterWithAI(game, desc, results[2].suggestions)
    : [];

  console.log(`\nFiltered results:`);
  console.log(`  Count 15 → Top 10: ${filtered15.length} games`);
  console.log(`  Count 20 → Top 10: ${filtered20.length} games`);

  // Compare overlap
  const direct10 = new Set(results[0].suggestions.map((s: any) => s.title.toLowerCase()));
  const from15 = new Set(filtered15.map((s: any) => s.title.toLowerCase()));
  const from20 = new Set(filtered20.map((s: any) => s.title.toLowerCase()));

  const overlap15 = [...direct10].filter(t => from15.has(t)).length;
  const overlap20 = [...direct10].filter(t => from20.has(t)).length;

  console.log(`\n🔄 Overlap with direct count=10:`);
  console.log(`  vs filtered-15: ${overlap15}/10 games`);
  console.log(`  vs filtered-20: ${overlap20}/10 games`);

  // Unique picks from filtered versions
  const unique15 = [...from15].filter(t => !direct10.has(t));
  const unique20 = [...from20].filter(t => !direct10.has(t));

  if (unique15.length > 0) {
    console.log(`\n🆕 Unique in filtered-15 (${unique15.length}):`);
    unique15.slice(0, 3).forEach(t => {
      const game = filtered15.find((s: any) => s.title.toLowerCase() === t);
      console.log(`  - ${game?.title || t}`);
    });
  }

  if (unique20.length > 0) {
    console.log(`\n🆕 Unique in filtered-20 (${unique20.length}):`);
    unique20.slice(0, 3).forEach(t => {
      const game = filtered20.find((s: any) => s.title.toLowerCase() === t);
      console.log(`  - ${game?.title || t}`);
    });
  }

  return {
    game,
    direct10: results[0].suggestions,
    from15: { raw: results[1].suggestions, filtered: filtered15 },
    from20: { raw: results[2].suggestions, filtered: filtered20 },
    overlap: { vs15: overlap15, vs20: overlap20 },
  };
}

async function main() {
  const testGames = [
    {
      title: "Arctic Eggs",
      desc: "Eggs: perfection in two parts. The simple whites. The sublime yolk.",
    },
    {
      title: "Noita",
      desc: "Magical action roguelite where every pixel is physically simulated.",
    },
  ];

  console.log("=".repeat(70));
  console.log("SEARCH DEPTH HYPOTHESIS TEST");
  console.log("=".repeat(70));
  console.log("Testing: Request more → filter vs Request exact count\n");

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game.title, game.desc);
    allResults.push(result);
    
    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 2s...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const outputPath = path.resolve(__dirname, `../../results-search-depth-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
