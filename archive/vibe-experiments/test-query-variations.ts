#!/usr/bin/env npx tsx

/**
 * HYPOTHESIS: Different query formulations produce different quality results.
 * Test variations in how we phrase the search query.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

type QueryVariation = {
  name: string;
  format: (game: string, desc: string) => string;
};

const VARIATIONS: QueryVariation[] = [
  {
    name: "question_style",
    format: (game, desc) => 
      `What are 10 indie games similar to "${game}" (${desc})?\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
  {
    name: "imperative",
    format: (game, desc) => 
      `Find 10 indie games similar to "${game}" (${desc}).\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
  {
    name: "player_perspective",
    format: (game, desc) => 
      `I enjoyed "${game}" (${desc}). Recommend 10 similar indie games.\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
  {
    name: "reddit_style",
    format: (game, desc) => 
      `Games like "${game}" (${desc})? Looking for similar indie titles.\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
  {
    name: "specific_aspects",
    format: (game, desc) => 
      `Find 10 indie games matching "${game}" (${desc}) in gameplay, aesthetic, and tone.\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
  {
    name: "avoid_mainstream",
    format: (game, desc) => 
      `Find 10 lesser-known indie games similar to "${game}" (${desc}). No AAA or mainstream titles.\n\nReturn JSON: [{"title":"Game","reason":"Why"}]`,
  },
];

async function testVariation(
  variation: QueryVariation,
  game: string,
  desc: string
): Promise<{ suggestions: any[]; elapsed: number; error?: string }> {
  const start = Date.now();
  
  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt: variation.format(game, desc),
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

async function testGame(game: string, desc: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${game}`);
  console.log("=".repeat(70));

  const results = await Promise.all(
    VARIATIONS.map(v => testVariation(v, game, desc))
  );

  console.log("\nResults:");
  VARIATIONS.forEach((v, i) => {
    const r = results[i];
    if (r.error) {
      console.log(`  ❌ ${v.name}: ${r.error}`);
    } else {
      console.log(`  ✅ ${v.name}: ${r.suggestions.length} suggestions (${r.elapsed}ms)`);
    }
  });

  // Analyze unique suggestions per variation
  const allTitles = new Set<string>();
  const variationTitles = new Map<string, Set<string>>();

  VARIATIONS.forEach((v, i) => {
    const titles = new Set(results[i].suggestions.map((s: any) => s.title.toLowerCase()));
    variationTitles.set(v.name, titles);
    titles.forEach(t => allTitles.add(t));
  });

  console.log(`\n📊 Total unique suggestions: ${allTitles.size}`);
  
  // Find variation-specific suggestions
  console.log("\n🔍 Variation-specific finds:");
  VARIATIONS.forEach((v, i) => {
    const titles = variationTitles.get(v.name)!;
    const unique = [...titles].filter(t => {
      return [...variationTitles.entries()].filter(([name, set]) => 
        name !== v.name && set.has(t)
      ).length === 0;
    });
    
    if (unique.length > 0) {
      console.log(`\n  ${v.name} (${unique.length} unique):`);
      unique.slice(0, 3).forEach(t => {
        const sug = results[i].suggestions.find((s: any) => s.title.toLowerCase() === t);
        console.log(`    - ${sug?.title || t}`);
      });
    }
  });

  return {
    game,
    variations: VARIATIONS.map((v, i) => ({
      name: v.name,
      ...results[i],
    })),
    totalUnique: allTitles.size,
  };
}

async function main() {
  const testGames = [
    {
      title: "Eating Nature",
      desc: "Sift through a nature documentary for clips about your favorite animal, the fish.",
    },
    {
      title: "Balatro",
      desc: "Poker-based roguelite deckbuilder with escalating combos and hypnotic progression.",
    },
  ];

  console.log("=".repeat(70));
  console.log("QUERY VARIATION HYPOTHESIS TEST");
  console.log("=".repeat(70));
  console.log(`Testing ${VARIATIONS.length} query formats on ${testGames.length} games\n`);

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game.title, game.desc);
    allResults.push(result);
    
    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 2s...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const outputPath = path.resolve(__dirname, `../../results-query-variations-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
