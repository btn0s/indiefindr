#!/usr/bin/env npx tsx

/**
 * Parallel Strategy Testing Script
 * 
 * Tests multiple search strategies simultaneously, then uses AI to curate the best results.
 * Runs in background and saves results to file.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

type SearchStrategy = {
  name: string;
  prompt: (game: string, desc: string, devs?: string[]) => string;
};

type RawSuggestion = {
  title: string;
  reason: string;
};

type StrategyResult = {
  strategy: string;
  suggestions: RawSuggestion[];
  elapsed: number;
  error?: string;
};

const STRATEGIES: SearchStrategy[] = [
  {
    name: "current",
    prompt: (game, desc, devs) => {
      const devContext = devs && devs.length > 0 ? ` by ${devs.join(", ")}` : "";
      return `Find 10 indie games similar to "${game}"${devContext} (${desc}).

Match the core loop, vibe, tone, pacing, and aesthetic. Consider games from similar developers.
Focus on indie/small studio games. Avoid AAA titles and big-budget games from major publishers.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
    },
  },
  {
    name: "genre_first",
    prompt: (game, desc) => {
      return `Find 10 indie games similar to "${game}" (${desc}).

First identify the genre/category, then find games that match both genre AND vibe.
Focus on indie games with similar mechanics and feel.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
    },
  },
  {
    name: "community_recommendations",
    prompt: (game, desc, devs) => {
      const devContext = devs && devs.length > 0 ? ` by ${devs.join(", ")}` : "";
      return `What indie games do players who enjoyed "${game}"${devContext} also recommend?

Look for games that real players recommend in forums, Steam reviews, and Reddit.
Focus on indie games, avoid AAA titles.

Find 10 games. Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why players recommend it"}]`;
    },
  },
  {
    name: "developer_similar",
    prompt: (game, desc, devs) => {
      const devContext = devs && devs.length > 0 ? ` Developers: ${devs.join(", ")}` : "";
      return `Find 10 indie games similar to "${game}" (${desc}).${devContext}

Focus on games from developers with similar style, budget, and aesthetic.
Look for games that share design philosophy and production values.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`;
    },
  },
  {
    name: "feeling_focused",
    prompt: (game, desc) => {
      return `Find 10 indie games that evoke the same FEELING as "${game}" (${desc}).

Match the emotional tone, atmosphere, and player experience.
What does this game make you FEEL? Find games with that same vibe.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it feels similar"}]`;
    },
  },
];

async function runStrategy(
  strategy: SearchStrategy,
  game: string,
  desc: string,
  devs?: string[]
): Promise<StrategyResult> {
  const start = Date.now();
  
  try {
    const prompt = strategy.prompt(game, desc, devs);
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return {
        strategy: strategy.name,
        suggestions: [],
        elapsed: Date.now() - start,
        error: "No JSON array found",
      };
    }

    try {
      const parsed = JSON.parse(match[0]) as RawSuggestion[];
      return {
        strategy: strategy.name,
        suggestions: parsed,
        elapsed: Date.now() - start,
      };
    } catch (parseErr) {
      return {
        strategy: strategy.name,
        suggestions: [],
        elapsed: Date.now() - start,
        error: `JSON parse error: ${parseErr}`,
      };
    }
  } catch (err) {
    return {
      strategy: strategy.name,
      suggestions: [],
      elapsed: Date.now() - start,
      error: `${err}`,
    };
  }
}

async function curateWithAI(
  sourceGame: string,
  sourceDesc: string,
  allSuggestions: { title: string; reason: string; sources: string[] }[]
): Promise<{ title: string; reason: string }[]> {
  const suggestionsList = allSuggestions
    .map((s, i) => `${i + 1}. "${s.title}" - ${s.reason} (from: ${s.sources.join(", ")})`)
    .join("\n");

  const prompt = `You are curating game recommendations for "${sourceGame}" (${sourceDesc}).

Here are candidate suggestions from multiple search strategies:

${suggestionsList}

Select the TOP 10 most relevant games. Prioritize:
1. Games that actually match the core gameplay and vibe
2. Games mentioned by multiple strategies (higher confidence)
3. Indie games over AAA titles
4. Unique/interesting picks over obvious choices

For each selected game, write a concise reason (under 15 words) why it's a good match.

Return ONLY valid JSON array:
[{"title":"Game Name","reason":"Why it's a great match"}]`;

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    return parsed.slice(0, 10);
  } catch (err) {
    console.error("AI curation failed:", err);
    return [];
  }
}

async function testGame(
  appid: number,
  title: string,
  desc: string,
  devs?: string[]
) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${title} (${appid})`);
  console.log("=".repeat(70));

  // Run all strategies in parallel
  console.log(`\n⚡ Running ${STRATEGIES.length} strategies in parallel...`);
  const startTime = Date.now();
  
  const results = await Promise.all(
    STRATEGIES.map(strategy => runStrategy(strategy, title, desc, devs))
  );
  
  const totalElapsed = Date.now() - startTime;
  console.log(`✅ All strategies completed in ${totalElapsed}ms\n`);

  // Display results per strategy
  console.log("Strategy Results:");
  for (const result of results) {
    if (result.error) {
      console.log(`  ❌ ${result.strategy}: ${result.error}`);
    } else {
      console.log(`  ✅ ${result.strategy}: ${result.suggestions.length} suggestions (${result.elapsed}ms)`);
    }
  }

  // Combine and dedupe
  const combined = new Map<string, { title: string; reason: string; sources: string[] }>();
  
  for (const result of results) {
    if (result.error) continue;
    
    for (const sug of result.suggestions) {
      const key = sug.title.toLowerCase().trim();
      if (combined.has(key)) {
        const existing = combined.get(key)!;
        existing.sources.push(result.strategy);
      } else {
        combined.set(key, {
          title: sug.title,
          reason: sug.reason,
          sources: [result.strategy],
        });
      }
    }
  }

  const allSuggestions = Array.from(combined.values());
  console.log(`\n📊 Combined: ${allSuggestions.length} unique suggestions`);
  
  // Show multi-source suggestions
  const multiSource = allSuggestions.filter(s => s.sources.length > 1);
  if (multiSource.length > 0) {
    console.log(`\n🎯 High confidence (multiple sources):`);
    multiSource
      .sort((a, b) => b.sources.length - a.sources.length)
      .slice(0, 5)
      .forEach(s => {
        console.log(`  - ${s.title} (${s.sources.length} sources: ${s.sources.join(", ")})`);
      });
  }

  // AI curation
  console.log(`\n🤖 Running AI curation...`);
  const curated = await curateWithAI(title, desc, allSuggestions);
  
  console.log(`\n✨ Final Top 10:`);
  curated.forEach((s, i) => {
    const original = allSuggestions.find(
      a => a.title.toLowerCase() === s.title.toLowerCase()
    );
    const sources = original?.sources || [];
    console.log(`  ${i + 1}. ${s.title}`);
    console.log(`     → ${s.reason}`);
    if (sources.length > 0) {
      console.log(`     Sources: ${sources.join(", ")}`);
    }
  });

  return {
    appid,
    title,
    strategyResults: results,
    combined: allSuggestions.length,
    curated: curated,
    totalTime: totalElapsed,
  };
}

async function main() {
  const testGames = [
    {
      appid: 2662730,
      title: "Eating Nature",
      desc: "Sift through a nature documentary for clips about your favorite animal, the fish.",
      devs: ["The Water Museum"],
    },
    {
      appid: 1262350,
      title: "Peglin",
      desc: "The dragons have been slain, the princess has been saved, and the evil sorcerer has been defeated. But just as peace was thought to be restored, the Peglin menace rises from below.",
      devs: ["Red Nexus Games"],
    },
    {
      appid: 881100,
      title: "Noita",
      desc: "Noita is a magical action roguelite set in a world where every pixel is physically simulated. Fight, explore, melt, burn, freeze and evaporate your way through the procedurally generated world using spells you've created yourself.",
      devs: ["Nolla Games"],
    },
  ];

  console.log("=".repeat(70));
  console.log("PARALLEL STRATEGY TESTING");
  console.log("=".repeat(70));
  console.log(`Testing ${STRATEGIES.length} strategies on ${testGames.length} games\n`);

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game.appid, game.title, game.desc, game.devs);
    allResults.push(result);
    
    // Rate limit between games
    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 3s before next game...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Save results to file
  const outputPath = path.resolve(__dirname, `../../results-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("COMPLETE!");
  console.log("=".repeat(70));
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
