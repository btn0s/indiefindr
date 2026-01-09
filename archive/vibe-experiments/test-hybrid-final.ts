#!/usr/bin/env npx tsx

/**
 * HYBRID APPROACH - Best learnings from all experiments:
 * 
 * 1. Run 3 complementary strategies in parallel (fast!)
 * 2. Include developer context in all queries
 * 3. Combine results with consensus weighting
 * 4. Use AI to curate final top 10
 * 5. Retry on JSON errors
 * 
 * Why these 3 strategies:
 * - vibe_focused: Catches atmosphere/tone matches (best for experimental games)
 * - mechanics_focused: Catches gameplay similarities (best for action/puzzle)
 * - community_driven: Gets real player recommendations (best for popular games)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

type Game = {
  appid: number;
  title: string;
  desc: string;
  devs?: string[];
};

type Suggestion = {
  title: string;
  reason: string;
};

type StrategyResult = {
  name: string;
  suggestions: Suggestion[];
  elapsed: number;
  error?: string;
};

const STRATEGIES = {
  vibe_focused: (game: Game) => {
    const devContext = game.devs && game.devs.length > 0 
      ? ` by ${game.devs.join(", ")}` 
      : "";
    
    return `Find 15 indie games with the SAME VIBE as "${game.title}"${devContext}.

Description: ${game.desc}

Match: atmosphere, mood, aesthetic, pacing, emotional tone, WEIRDNESS/EXPERIMENTAL nature if applicable.
If the game is surreal/avant-garde/experimental, prioritize OTHER weird games, NOT just thematic matches.
Consider games from similar developers. Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it feels similar"}]`;
  },

  mechanics_focused: (game: Game) => {
    const devContext = game.devs && game.devs.length > 0 
      ? ` by ${game.devs.join(", ")}` 
      : "";

    return `Find 15 indie games with similar GAMEPLAY to "${game.title}"${devContext}.

Description: ${game.desc}

Match: core loop, interaction mechanics, control feel, gameplay systems.
Consider games from similar developers. Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why gameplay matches"}]`;
  },

  community_driven: (game: Game) => {
    const devContext = game.devs && game.devs.length > 0 
      ? ` by ${game.devs.join(", ")}` 
      : "";

    return `Find 15 indie games that fans of "${game.title}"${devContext} actually recommend.

Description: ${game.desc}

Look for games the community loves together. Match the overall appeal.
Consider games from similar developers. Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why fans love it"}]`;
  },
};

async function runStrategy(
  name: string,
  prompt: string,
  retries = 2
): Promise<StrategyResult> {
  const start = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { text } = await generateText({
        model: "perplexity/sonar",
        prompt,
      });

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        if (attempt < retries) {
          console.log(`  [${name}] No JSON, retrying (${attempt + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return {
          name,
          suggestions: [],
          elapsed: Date.now() - start,
          error: "No JSON found",
        };
      }

      try {
        const parsed = JSON.parse(match[0]) as Suggestion[];
        return {
          name,
          suggestions: parsed,
          elapsed: Date.now() - start,
        };
      } catch (parseErr) {
        if (attempt < retries) {
          console.log(`  [${name}] Parse error, retrying (${attempt + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return {
          name,
          suggestions: [],
          elapsed: Date.now() - start,
          error: "JSON parse error",
        };
      }
    } catch (err) {
      if (attempt < retries) {
        console.log(`  [${name}] Error, retrying (${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return {
        name,
        suggestions: [],
        elapsed: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    name,
    suggestions: [],
    elapsed: Date.now() - start,
    error: "All retries failed",
  };
}

async function curateWithAI(
  game: Game,
  allSuggestions: Map<string, { count: number; reasons: string[]; sources: string[] }>
): Promise<Suggestion[]> {
  // Sort by mention count (consensus)
  const sorted = Array.from(allSuggestions.entries())
    .sort((a, b) => b[1].count - a[1].count);

  // Take top 20 for AI curation
  const candidates = sorted.slice(0, 20);

  const suggestionsList = candidates
    .map((
      [title, data], i) => 
      `${i + 1}. "${title}" (${data.count}/3 strategies) - ${data.reasons[0]}`
    )
    .join("\n");

  const prompt = `Curate game recommendations for "${game.title}" (${game.desc}).

Candidates (sorted by consensus):
${suggestionsList}

Select the TOP 10 most relevant. Prioritize:
1. Games mentioned by multiple strategies (higher consensus)
2. True gameplay/vibe matches
3. Indie games over AAA
4. Interesting/unique picks

Write concise reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it's great"}]`;

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return sorted.slice(0, 10).map(([title, data]) => ({
      title,
      reason: data.reasons[0],
    }));

    const parsed = JSON.parse(match[0]) as Suggestion[];
    return parsed.slice(0, 10);
  } catch (err) {
    console.error("  AI curation failed, using consensus ranking");
    return sorted.slice(0, 10).map(([title, data]) => ({
      title,
      reason: data.reasons[0],
    }));
  }
}

async function testGame(game: Game) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${game.title} (${game.appid})`);
  if (game.devs && game.devs.length > 0) {
    console.log(`Devs: ${game.devs.join(", ")}`);
  }
  console.log("=".repeat(70));

  // Generate prompts
  const prompts = {
    vibe_focused: STRATEGIES.vibe_focused(game),
    mechanics_focused: STRATEGIES.mechanics_focused(game),
    community_driven: STRATEGIES.community_driven(game),
  };

  // Run all strategies in parallel
  console.log("\n⚡ Running 3 strategies in parallel...");
  const startTime = Date.now();

  const results = await Promise.all([
    runStrategy("vibe_focused", prompts.vibe_focused),
    runStrategy("mechanics_focused", prompts.mechanics_focused),
    runStrategy("community_driven", prompts.community_driven),
  ]);

  const totalElapsed = Date.now() - startTime;
  console.log(`✅ All strategies completed in ${totalElapsed}ms\n`);

  // Show individual results
  console.log("Strategy Results:");
  results.forEach(result => {
    if (result.error) {
      console.log(`  ❌ ${result.name}: ${result.error}`);
    } else {
      console.log(`  ✅ ${result.name}: ${result.suggestions.length} suggestions (${result.elapsed}ms)`);
    }
  });

  // Combine results
  const combined = new Map<string, { count: number; reasons: string[]; sources: string[] }>();

  for (const result of results) {
    if (result.error) continue;

    for (const sug of result.suggestions) {
      const key = sug.title.toLowerCase().trim();
      if (combined.has(key)) {
        const existing = combined.get(key)!;
        existing.count++;
        existing.reasons.push(sug.reason);
        existing.sources.push(result.name);
      } else {
        combined.set(key, {
          count: 1,
          reasons: [sug.reason],
          sources: [result.name],
        });
      }
    }
  }

  console.log(`\n📊 Combined: ${combined.size} unique suggestions`);

  // Show high-consensus picks
  const highConsensus = Array.from(combined.entries())
    .filter(([_, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  if (highConsensus.length > 0) {
    console.log(`\n🎯 High consensus (2+ strategies): ${highConsensus.length} games`);
    highConsensus.slice(0, 5).forEach(([title, data]) => {
      console.log(`  - ${title} (${data.count}/3: ${data.sources.join(", ")})`);
    });
  }

  // AI curation
  console.log(`\n🤖 Running AI curation...`);
  const curated = await curateWithAI(game, combined);

  console.log(`\n✨ Final Top 10:`);
  curated.forEach((s, i) => {
    if (!s || !s.title) {
      console.log(`  ${i + 1}. [Invalid suggestion]`);
      return;
    }
    const original = Array.from(combined.entries()).find(
      ([title]) => title.toLowerCase() === s.title.toLowerCase()
    );
    const consensus = original ? `[${original[1].count}/3]` : "[AI pick]";
    console.log(`  ${i + 1}. ${s.title} ${consensus}`);
    console.log(`     → ${s.reason}`);
  });

  return {
    appid: game.appid,
    title: game.title,
    strategies: results,
    combined: combined.size,
    highConsensus: highConsensus.length,
    curated,
    totalTime: totalElapsed,
  };
}

async function main() {
  const testGames: Game[] = [
    {
      appid: 2379780,
      title: "Balatro",
      desc: "Poker-based roguelite deckbuilder with escalating combos and hypnotic progression.",
      devs: ["LocalThunk"],
    },
    {
      appid: 1145360,
      title: "Hades",
      desc: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.",
      devs: ["Supergiant Games"],
    },
    {
      appid: 1262350,
      title: "Peglin",
      desc: "The dragons have been slain, the princess has been saved, and the evil sorcerer has been defeated.",
      devs: ["Red Nexus Games"],
    },
    {
      appid: 2662730,
      title: "Eating Nature",
      desc: "Sift through a nature documentary for clips about your favorite animal, the fish.",
      devs: ["The Water Museum"],
    },
    {
      appid: 2251540,
      title: "IBIS AM",
      desc: "All I want you to do is catch fish and search for others who seem hungry. You are only a bird.",
      devs: ["The Water Museum"],
    },
    {
      appid: 913740,
      title: "WORLD OF HORROR",
      desc: "Experience the quiet terror of this 1-bit love letter to Junji Ito and H.P. Lovecraft.",
      devs: ["Panstasz"],
    },
  ];

  console.log("=".repeat(70));
  console.log("HYBRID APPROACH - Final Test");
  console.log("=".repeat(70));
  console.log("3 strategies in parallel + AI curation\n");

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game);
    allResults.push(result);

    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 2s before next game...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save results
  const outputPath = path.resolve(__dirname, `../../results-hybrid-final-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));

  // Summary
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));

  allResults.forEach(result => {
    console.log(`\n${result.title}:`);
    console.log(`  Total unique: ${result.combined}`);
    console.log(`  High consensus: ${result.highConsensus}`);
    console.log(`  Final curated: ${result.curated.length}`);
    console.log(`  Time: ${result.totalTime}ms`);
  });

  console.log(`\n\n✅ Results saved to: ${outputPath}`);
}

main().catch(console.error);
