#!/usr/bin/env npx tsx

/**
 * HYPOTHESIS: Simulating real user search queries produces better results
 * than structured AI prompts, since Perplexity is trained on actual searches.
 * 
 * Test natural queries like:
 * - "games like [title]"
 * - "games similar to [title]"
 * - "[title] recommendations"
 * - "games from [developer]"
 * etc.
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

type QueryTemplate = {
  name: string;
  generate: (game: Game) => string;
};

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    name: "games_like",
    generate: (game) => `games like ${game.title}`,
  },
  {
    name: "similar_to",
    generate: (game) => `games similar to ${game.title}`,
  },
  {
    name: "recommendations",
    generate: (game) => `${game.title} game recommendations`,
  },
  {
    name: "if_you_liked",
    generate: (game) => `if you liked ${game.title}`,
  },
  {
    name: "alternatives",
    generate: (game) => `${game.title} alternatives`,
  },
  {
    name: "question_what",
    generate: (game) => `what games are similar to ${game.title}?`,
  },
  {
    name: "question_recommend",
    generate: (game) => `what games would you recommend if I like ${game.title}?`,
  },
  {
    name: "reddit_games_like",
    generate: (game) => `site:reddit.com games like ${game.title}`,
  },
  {
    name: "reddit_similar",
    generate: (game) => `site:reddit.com ${game.title} similar games`,
  },
  {
    name: "reddit_if_you_liked",
    generate: (game) => `site:reddit.com "if you liked ${game.title}"`,
  },
  {
    name: "steam_community",
    generate: (game) => `site:steamcommunity.com games similar to ${game.title}`,
  },
  {
    name: "itch_similar",
    generate: (game) => `site:itch.io games like ${game.title}`,
  },
  {
    name: "pcgamer_like",
    generate: (game) => `site:pcgamer.com games like ${game.title}`,
  },
  {
    name: "rockpapershotgun",
    generate: (game) => `site:rockpapershotgun.com similar to ${game.title}`,
  },
  {
    name: "from_developer",
    generate: (game) => 
      game.devs && game.devs.length > 0 
        ? `games from ${game.devs[0]}`
        : `games like ${game.title}`,
  },
  {
    name: "developer_similar",
    generate: (game) => 
      game.devs && game.devs.length > 0
        ? `indie games similar to ${game.devs[0]} games`
        : `indie games like ${game.title}`,
  },
  {
    name: "twitter_recommendations",
    generate: (game) => `site:twitter.com ${game.title} recommendations`,
  },
  {
    name: "youtube_like",
    generate: (game) => `site:youtube.com games like ${game.title}`,
  },
];

async function runSearchQuery(
  template: QueryTemplate,
  game: Game
): Promise<{ rawResponse: string; elapsed: number; error?: string }> {
  const searchQuery = template.generate(game);
  const start = Date.now();

  // Send the raw search query - exactly what a user would type
  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt: searchQuery,
    });

    return { rawResponse: text, elapsed: Date.now() - start };
  } catch (err) {
    return { 
      rawResponse: "", 
      elapsed: Date.now() - start, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}

async function runStructuredPrompt(
  game: Game
): Promise<{ suggestions: any[]; elapsed: number; error?: string }> {
  const start = Date.now();
  
  const devContext = game.devs && game.devs.length > 0 
    ? ` by ${game.devs.join(", ")}` 
    : "";

  const prompt = `Find 10 indie games similar to "${game.title}"${devContext} (${game.desc}).

Match the core loop, vibe, tone, pacing, and aesthetic. Consider games from similar developers.
Focus on indie/small studio games. Avoid AAA titles and big-budget games from major publishers.

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
    return { 
      suggestions: [], 
      elapsed: Date.now() - start, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}

async function testGame(game: Game) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${game.title} (${game.appid})`);
  console.log(`Devs: ${game.devs?.join(", ") || "N/A"}`);
  console.log("=".repeat(70));

  // Test structured prompt first
  console.log("\n🔧 Testing STRUCTURED prompt...");
  const structured = await runStructuredPrompt(game);
  if (structured.error) {
    console.log(`  ❌ Error: ${structured.error}`);
  } else {
    console.log(`  ✅ ${structured.suggestions.length} results in ${structured.elapsed}ms`);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test all search-style queries IN PARALLEL
  console.log("\n🔍 Testing SEARCH-STYLE queries (in parallel)...");
  
  const queryPromises = QUERY_TEMPLATES.map(template => {
    const query = template.generate(game);
    console.log(`  Queued: [${template.name}] "${query}"`);
    return runSearchQuery(template, game).then(result => ({
      template: template.name,
      query,
      ...result,
    }));
  });

  const queryResults = await Promise.all(queryPromises);
  
  console.log("\n  Results:");
  queryResults.forEach(result => {
    if (result.error) {
      console.log(`    ❌ [${result.template}] Error: ${result.error}`);
    } else {
      const preview = result.rawResponse.substring(0, 100).replace(/\n/g, " ");
      console.log(`    ✅ [${result.template}] ${result.elapsed}ms - "${preview}..."`);
    }
  });

  // Analyze results
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("ANALYSIS - Raw Search Responses");
  console.log("=".repeat(70));

  console.log("\n📝 Raw responses from search queries:");
  queryResults.forEach(result => {
    if (!result.error) {
      console.log(`\n--- [${result.template}] "${result.query}" ---`);
      console.log(result.rawResponse.substring(0, 500));
      if (result.rawResponse.length > 500) {
        console.log("...(truncated)");
      }
    }
  });

  console.log(`\n\n🔧 Structured prompt response:`);
  if (!structured.error) {
    console.log(`Found ${structured.suggestions.length} suggestions:`);
    structured.suggestions.slice(0, 5).forEach(s => {
      console.log(`  - ${s.title}: ${s.reason}`);
    });
  }

  return {
    game: game.title,
    structured,
    queries: queryResults,
  };
}

async function main() {
  const testGames: Game[] = [
    {
      appid: 2662730,
      title: "Eating Nature",
      desc: "Sift through a nature documentary for clips about your favorite animal, the fish.",
      devs: ["The Water Museum"],
    },
    {
      appid: 881100,
      title: "Noita",
      desc: "Noita is a magical action roguelite set in a world where every pixel is physically simulated.",
      devs: ["Nolla Games"],
    },
    {
      appid: 2379780,
      title: "Balatro",
      desc: "Poker-based roguelite deckbuilder with escalating combos and hypnotic progression.",
      devs: ["LocalThunk"],
    },
  ];

  console.log("=".repeat(70));
  console.log("SEARCH QUERY SIMULATION TEST");
  console.log("=".repeat(70));
  console.log(`Testing ${QUERY_TEMPLATES.length} search-style queries vs structured prompts\n`);

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game);
    allResults.push(result);
    
    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 3s before next game...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const outputPath = path.resolve(__dirname, `../../results-search-queries-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("COMPLETE!");
  console.log("=".repeat(70));
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
