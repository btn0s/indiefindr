#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

// Test different prompt strategies
const STRATEGIES = {
  current: (title: string, desc: string, devs: string[]) => {
    const devContext = devs.length > 0 ? ` by ${devs.join(", ")}` : "";
    return `Find 10 indie games similar to "${title}"${devContext} (${desc}).

Match the core loop, vibe, tone, pacing, and aesthetic. Consider games from similar developers.
Focus on indie/small studio games. Avoid AAA titles and big-budget games from major publishers.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },

  developer_focused: (title: string, desc: string, devs: string[]) => {
    const devContext = devs.length > 0 ? ` by ${devs.join(", ")}` : "";
    return `Find 10 indie games similar to "${title}"${devContext}.

Description: ${desc}

PRIORITIZE games from similar developers, publishers, or studios with matching creative vision.
Look for shared aesthetic, tone, and design philosophy.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },

  vibe_heavy: (title: string, desc: string, devs: string[]) => {
    return `Find 10 indie games with the SAME VIBE as "${title}".

Description: ${desc}

Match: atmosphere, mood, aesthetic style, pacing, emotional tone.
Focus on how the game FEELS, not just mechanics or genre.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },

  mechanics_focused: (title: string, desc: string, devs: string[]) => {
    return `Find 10 indie games with similar GAMEPLAY to "${title}".

Description: ${desc}

Match: core loop, interaction mechanics, control feel, gameplay systems.
Prioritize games that PLAY similarly, regardless of theme.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },

  community_driven: (title: string, desc: string, devs: string[]) => {
    return `Find 10 indie games that fans of "${title}" also love.

Description: ${desc}

Look for games that the community actually recommends together.
Match the overall appeal and player experience.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },

  tags_first: (title: string, desc: string, devs: string[]) => {
    return `Find 10 indie games similar to "${title}".

Description: ${desc}

First identify key tags/themes, then find games sharing those elements.
Match: genre, setting, themes, visual style, pacing.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  },
};

type StrategyKey = keyof typeof STRATEGIES;

type SuggestionResult = {
  title: string;
  reason: string;
};

async function testStrategy(
  strategy: StrategyKey,
  title: string,
  desc: string,
  devs: string[]
): Promise<{ results: SuggestionResult[]; elapsed: number; error?: string }> {
  const prompt = STRATEGIES[strategy](title, desc, devs);
  const start = Date.now();

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return { results: [], elapsed: Date.now() - start, error: "No JSON found" };
    }

    const parsed = JSON.parse(match[0]) as SuggestionResult[];
    return { results: parsed, elapsed: Date.now() - start };
  } catch (err) {
    return {
      results: [],
      elapsed: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function rankCombinedResults(
  gameTitle: string,
  gameDesc: string,
  allSuggestions: Map<string, { count: number; reasons: string[] }>
): Promise<string[]> {
  // Create a prompt to rank the compiled suggestions
  const suggestionsList = Array.from(allSuggestions.entries())
    .map(([title, data]) => `${title} (mentioned ${data.count}x)`)
    .join(", ");

  const prompt = `Given the game "${gameTitle}" (${gameDesc}), rank these suggested games by relevance:

${suggestionsList}

Return ONLY a JSON array of game titles in order from most to least relevant:
["Game 1", "Game 2", ...]`;

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as string[];
    }
  } catch (err) {
    console.error("Ranking error:", err);
  }

  // Fallback: sort by mention count
  return Array.from(allSuggestions.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([title]) => title);
}

async function main() {
  const supabase = getSupabaseServerClient();

  // Test games spanning different types
  const testGameIds = [
    2662730, // Eating Nature - weird experimental
    1262350, // Peglin - roguelite action
    881100,  // Noita - action roguelite
    2251540, // IBIS AM - art game
  ];

  console.log("=".repeat(70));
  console.log("SUGGESTION STRATEGY COMPARISON");
  console.log("=".repeat(70));

  for (const appid of testGameIds) {
    const { data: game } = await supabase
      .from("games_new")
      .select("appid, title, short_description, developers")
      .eq("appid", appid)
      .single();

    if (!game) continue;

    console.log(`\n\n${"=".repeat(70)}`);
    console.log(`GAME: ${game.title} (${game.appid})`);
    console.log(`DESC: ${game.short_description?.substring(0, 100)}...`);
    console.log(`DEVS: ${game.developers?.join(", ") || "N/A"}`);
    console.log("=".repeat(70));

    const strategies = Object.keys(STRATEGIES) as StrategyKey[];
    const results: Record<StrategyKey, SuggestionResult[]> = {} as any;

    // Test each strategy
    for (const strategy of strategies) {
      console.log(`\n[${strategy}] Testing...`);
      const result = await testStrategy(
        strategy,
        game.title,
        game.short_description || "",
        game.developers || []
      );

      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      } else {
        console.log(`  ✅ ${result.results.length} results in ${result.elapsed}ms`);
        results[strategy] = result.results;
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Compile and analyze results
    console.log(`\n\n${"=".repeat(70)}`);
    console.log("ANALYSIS");
    console.log("=".repeat(70));

    // Count overlaps
    const allSuggestions = new Map<string, { count: number; reasons: string[]; strategies: string[] }>();
    
    for (const [strategy, suggestions] of Object.entries(results)) {
      for (const sug of suggestions) {
        const existing = allSuggestions.get(sug.title);
        if (existing) {
          existing.count++;
          existing.reasons.push(sug.reason);
          existing.strategies.push(strategy);
        } else {
          allSuggestions.set(sug.title, {
            count: 1,
            reasons: [sug.reason],
            strategies: [strategy],
          });
        }
      }
    }

    // Show most-mentioned games
    const sorted = Array.from(allSuggestions.entries())
      .sort((a, b) => b[1].count - a[1].count);

    console.log("\n📊 Most Mentioned Across Strategies:");
    sorted.slice(0, 10).forEach(([title, data], i) => {
      console.log(`\n${i + 1}. ${title} (${data.count}/${strategies.length} strategies)`);
      console.log(`   Strategies: ${data.strategies.join(", ")}`);
      console.log(`   Reasons:`);
      data.reasons.forEach((r) => console.log(`     - ${r}`));
    });

    // Show unique suggestions per strategy
    console.log("\n\n🎯 Unique to Each Strategy:");
    for (const strategy of strategies) {
      const unique = results[strategy]?.filter(
        (s) => allSuggestions.get(s.title)?.count === 1
      ) || [];
      
      if (unique.length > 0) {
        console.log(`\n[${strategy}]: ${unique.length} unique`);
        unique.slice(0, 3).forEach((s) => {
          console.log(`  - ${s.title}: ${s.reason}`);
        });
      }
    }

    // AI-powered ranking of combined results
    console.log("\n\n🤖 AI-Ranked Combined Results:");
    const ranked = await rankCombinedResults(
      game.title,
      game.short_description || "",
      allSuggestions as any
    );
    
    ranked.slice(0, 10).forEach((title, i) => {
      const data = allSuggestions.get(title);
      console.log(`${i + 1}. ${title} (mentioned ${data?.count}x)`);
    });
  }

  console.log("\n\n✅ Experiment complete!");
}

main().catch(console.error);
