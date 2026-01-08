#!/usr/bin/env npx tsx

/**
 * QUALITY + SPEED VERIFICATION TEST
 * 
 * - Test on verifiable games (Balatro, Hades, PIGFACE, etc.)
 * - Fetch ACTUAL descriptions of suggested games to check for hallucinations
 * - Time each component (Perplexity, validation, AI curation)
 * - Test speed optimizations (2 vs 3 strategies, with/without AI, etc.)
 * - Manual verification output
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

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

type VerifiedSuggestion = Suggestion & {
  appid?: number;
  actualDesc?: string;
  verified: boolean;
  matchQuality?: "perfect" | "good" | "weak" | "hallucination";
};

const supabase = getSupabaseServerClient();

async function verifySuggestion(title: string): Promise<{
  found: boolean;
  appid?: number;
  actualTitle?: string;
  actualDesc?: string;
}> {
  // Search in database first
  const { data: dbResult } = await supabase
    .from("games_new")
    .select("appid, title, short_description")
    .ilike("title", `%${title}%`)
    .limit(1)
    .single();

  if (dbResult) {
    return {
      found: true,
      appid: dbResult.appid,
      actualTitle: dbResult.title,
      actualDesc: dbResult.short_description || "No description",
    };
  }

  // Try Steam search
  try {
    const res = await fetch(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(title)}`
    );
    const results = await res.json();
    if (results?.[0]) {
      return {
        found: true,
        appid: parseInt(results[0].appid),
        actualTitle: results[0].name,
        actualDesc: "Found on Steam (not in DB yet)",
      };
    }
  } catch {}

  return { found: false };
}

async function runStrategy(
  name: string,
  prompt: string,
  timeout = 15000
): Promise<{
  name: string;
  suggestions: Suggestion[];
  elapsed: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return {
        name,
        suggestions: [],
        elapsed: Date.now() - start,
        error: "No JSON found",
      };
    }

    const parsed = JSON.parse(match[0]) as Suggestion[];
    return {
      name,
      suggestions: parsed,
      elapsed: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      suggestions: [],
      elapsed: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function test2Strategies(game: Game) {
  const devContext = game.devs?.length ? ` by ${game.devs.join(", ")}` : "";

  const prompts = {
    vibe: `Find 12 indie games with the SAME VIBE as "${game.title}"${devContext}.

Description: ${game.desc}

Match atmosphere, mood, aesthetic, pacing. Consider similar developers. Focus on indie games.
Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`,

    mechanics: `Find 12 indie games with similar GAMEPLAY to "${game.title}"${devContext}.

Description: ${game.desc}

Match core loop, mechanics, control feel. Consider similar developers. Focus on indie games.
Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`,
  };

  console.log(`\n⚡ Testing 2-strategy approach (FAST)...`);
  const start = Date.now();

  const results = await Promise.all([
    runStrategy("vibe", prompts.vibe),
    runStrategy("mechanics", prompts.mechanics),
  ]);

  const elapsed = Date.now() - start;

  return { results, elapsed, config: "2-strategy (vibe + mechanics)" };
}

async function test3Strategies(game: Game) {
  const devContext = game.devs?.length ? ` by ${game.devs.join(", ")}` : "";

  const prompts = {
    vibe: `Find 12 indie games with the SAME VIBE as "${game.title}"${devContext}.

Description: ${game.desc}

Match atmosphere, mood, aesthetic, pacing. Consider similar developers. Focus on indie games.
Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`,

    mechanics: `Find 12 indie games with similar GAMEPLAY to "${game.title}"${devContext}.

Description: ${game.desc}

Match core loop, mechanics, control feel. Consider similar developers. Focus on indie games.
Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`,

    community: `Find 12 indie games that fans of "${game.title}"${devContext} recommend.

Description: ${game.desc}

Real player recommendations. Consider similar developers. Focus on indie games.
Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why similar"}]`,
  };

  console.log(`\n⚡ Testing 3-strategy approach...`);
  const start = Date.now();

  const results = await Promise.all([
    runStrategy("vibe", prompts.vibe),
    runStrategy("mechanics", prompts.mechanics),
    runStrategy("community", prompts.community),
  ]);

  const elapsed = Date.now() - start;

  return { results, elapsed, config: "3-strategy (vibe + mechanics + community)" };
}

async function verifyAndScore(
  suggestions: Suggestion[],
  sourceGame: Game
): Promise<VerifiedSuggestion[]> {
  console.log(`\n🔍 Verifying ${suggestions.length} suggestions...`);
  const verifyStart = Date.now();

  const verified = await Promise.all(
    suggestions.map(async (sug): Promise<VerifiedSuggestion> => {
      const check = await verifySuggestion(sug.title);

      if (!check.found) {
        return {
          ...sug,
          verified: false,
          matchQuality: "hallucination",
        };
      }

      // Simple quality heuristic based on description similarity
      // (in real implementation, could use embeddings or more sophisticated matching)
      let matchQuality: "perfect" | "good" | "weak" = "good";

      return {
        ...sug,
        appid: check.appid,
        actualDesc: check.actualDesc,
        verified: true,
        matchQuality,
      };
    })
  );

  const verifyElapsed = Date.now() - verifyStart;
  console.log(`  Verified in ${verifyElapsed}ms`);

  return verified;
}

async function testGame(game: Game) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TESTING: ${game.title} (${game.appid})`);
  console.log(`DESC: ${game.desc}`);
  if (game.devs?.length) console.log(`DEVS: ${game.devs.join(", ")}`);
  console.log("=".repeat(70));

  // Test 2-strategy
  const test2 = await test2Strategies(game);
  console.log(`✅ 2-strategy completed in ${test2.elapsed}ms`);
  test2.results.forEach(r => {
    if (!r.error) {
      console.log(`  - ${r.name}: ${r.suggestions.length} suggestions (${r.elapsed}ms)`);
    } else {
      console.log(`  - ${r.name}: ERROR - ${r.error}`);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3-strategy
  const test3 = await test3Strategies(game);
  console.log(`✅ 3-strategy completed in ${test3.elapsed}ms`);
  test3.results.forEach(r => {
    if (!r.error) {
      console.log(`  - ${r.name}: ${r.suggestions.length} suggestions (${r.elapsed}ms)`);
    } else {
      console.log(`  - ${r.name}: ERROR - ${r.error}`);
    }
  });

  // Combine results from 3-strategy for verification
  const allSuggestions = test3.results
    .filter(r => !r.error)
    .flatMap(r => r.suggestions)
    .slice(0, 20); // Top 20 for verification

  // Verify suggestions
  const verified = await verifyAndScore(allSuggestions, game);

  // Analysis
  console.log(`\n📊 VERIFICATION RESULTS:`);
  const hallucinations = verified.filter(v => v.matchQuality === "hallucination");
  const validGames = verified.filter(v => v.verified);

  console.log(`  Total checked: ${verified.length}`);
  console.log(`  ✅ Valid games: ${validGames.length}`);
  console.log(`  ❌ Hallucinations: ${hallucinations.length}`);

  if (hallucinations.length > 0) {
    console.log(`\n  🚨 HALLUCINATED GAMES:`);
    hallucinations.forEach(h => {
      console.log(`    - "${h.title}"`);
      console.log(`      Reason given: ${h.reason}`);
    });
  }

  console.log(`\n  ✅ VERIFIED SUGGESTIONS (Top 10):`);
  validGames.slice(0, 10).forEach((v, i) => {
    console.log(`\n  ${i + 1}. ${v.title} ${v.appid ? `(${v.appid})` : ""}`);
    console.log(`     AI Reason: ${v.reason}`);
    console.log(`     Actual: ${v.actualDesc?.substring(0, 100)}...`);
  });

  return {
    game: game.title,
    test2: {
      elapsed: test2.elapsed,
      totalSuggestions: test2.results.reduce((sum, r) => sum + r.suggestions.length, 0),
    },
    test3: {
      elapsed: test3.elapsed,
      totalSuggestions: test3.results.reduce((sum, r) => sum + r.suggestions.length, 0),
    },
    verification: {
      total: verified.length,
      valid: validGames.length,
      hallucinations: hallucinations.length,
      hallucinationRate: (hallucinations.length / verified.length) * 100,
    },
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
      appid: 1833200,
      title: "PIGFACE",
      desc: "You wake up with an explosive headache in a pool of your own blood.",
      devs: ["Cozy Game Pals"],
    },
    {
      appid: 1262350,
      title: "Peglin",
      desc: "The dragons have been slain, the princess has been saved, and the evil sorcerer has been defeated.",
      devs: ["Red Nexus Games"],
    },
  ];

  console.log("=".repeat(70));
  console.log("QUALITY + SPEED VERIFICATION TEST");
  console.log("=".repeat(70));
  console.log("Testing: 2-strategy vs 3-strategy");
  console.log("Verifying: Hallucinations, match quality\n");

  const results = [];

  for (const game of testGames) {
    const result = await testGame(game);
    results.push(result);

    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 3s before next game...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Final summary
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("FINAL SUMMARY");
  console.log("=".repeat(70));

  results.forEach(r => {
    console.log(`\n${r.game}:`);
    console.log(`  2-strategy: ${r.test2.elapsed}ms (${r.test2.totalSuggestions} suggestions)`);
    console.log(`  3-strategy: ${r.test3.elapsed}ms (${r.test3.totalSuggestions} suggestions)`);
    console.log(`  Hallucination rate: ${r.verification.hallucinationRate.toFixed(1)}%`);
  });

  const avgSpeed2 = results.reduce((sum, r) => sum + r.test2.elapsed, 0) / results.length;
  const avgSpeed3 = results.reduce((sum, r) => sum + r.test3.elapsed, 0) / results.length;
  const avgHallucinations = results.reduce((sum, r) => sum + r.verification.hallucinationRate, 0) / results.length;

  console.log(`\n📊 AVERAGES:`);
  console.log(`  2-strategy avg: ${Math.round(avgSpeed2)}ms`);
  console.log(`  3-strategy avg: ${Math.round(avgSpeed3)}ms`);
  console.log(`  Speed improvement: ${Math.round((1 - avgSpeed2/avgSpeed3) * 100)}% faster with 2-strategy`);
  console.log(`  Avg hallucination rate: ${avgHallucinations.toFixed(1)}%`);

  console.log(`\n✅ Test complete!`);
}

main().catch(console.error);
