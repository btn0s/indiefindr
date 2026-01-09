#!/usr/bin/env npx tsx

/**
 * HYPOTHESIS: Extracting tags/themes first, then searching with expanded context
 * produces better, more specific matches than direct similarity queries.
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

async function extractTags(game: Game): Promise<string[]> {
  const prompt = `Analyze this game and extract 8-10 specific tags/themes/mechanics:

Game: "${game.title}"
Description: ${game.desc}

Focus on:
- Core mechanics (roguelike, puzzle, platformer, etc)
- Aesthetic (pixel art, hand-drawn, minimalist, etc)
- Tone (cozy, horror, melancholic, whimsical, etc)
- Pacing (fast-paced, contemplative, slow-burn, etc)
- Perspective (first-person, top-down, side-view, etc)

Return ONLY a JSON array of tags: ["tag1", "tag2", ...]`;

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    });

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("Tag extraction failed:", err);
    return [];
  }
}

async function searchWithTags(game: Game, tags: string[]): Promise<any[]> {
  const tagList = tags.join(", ");
  const devContext = game.devs && game.devs.length > 0 ? ` by ${game.devs.join(", ")}` : "";
  
  const prompt = `Find 10 indie games similar to "${game.title}"${devContext}.

Key characteristics: ${tagList}

Match games that share these specific tags and characteristics.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("Search with tags failed:", err);
    return [];
  }
}

async function searchDirect(game: Game): Promise<any[]> {
  const devContext = game.devs && game.devs.length > 0 ? ` by ${game.devs.join(", ")}` : "";
  
  const prompt = `Find 10 indie games similar to "${game.title}"${devContext} (${game.desc}).

Match the core loop, vibe, tone, pacing, and aesthetic.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("Direct search failed:", err);
    return [];
  }
}

async function testGame(game: Game) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${game.title}`);
  console.log("=".repeat(70));

  // Extract tags first
  console.log("\n🏷️  Extracting tags...");
  const tags = await extractTags(game);
  console.log(`   Tags: ${tags.join(", ")}`);

  // Run both approaches in parallel
  console.log("\n⚡ Running tag-based vs direct search...");
  const [tagResults, directResults] = await Promise.all([
    searchWithTags(game, tags),
    searchDirect(game),
  ]);

  console.log(`\n📊 Results:`);
  console.log(`   Tag-based: ${tagResults.length} suggestions`);
  console.log(`   Direct: ${directResults.length} suggestions`);

  // Compare overlap
  const tagTitles = new Set(tagResults.map((r: any) => r.title.toLowerCase()));
  const directTitles = new Set(directResults.map((r: any) => r.title.toLowerCase()));
  
  const overlap = [...tagTitles].filter(t => directTitles.has(t));
  const tagOnly = [...tagTitles].filter(t => !directTitles.has(t));
  const directOnly = [...directTitles].filter(t => !tagTitles.has(t));

  console.log(`\n🔄 Overlap: ${overlap.length} games`);
  if (overlap.length > 0) {
    console.log(`   ${overlap.slice(0, 5).join(", ")}${overlap.length > 5 ? "..." : ""}`);
  }

  console.log(`\n🏷️  Tag-based only (${tagOnly.length}):`);
  tagOnly.slice(0, 5).forEach(t => {
    const game = tagResults.find((r: any) => r.title.toLowerCase() === t);
    console.log(`   - ${game.title}`);
  });

  console.log(`\n🎯 Direct only (${directOnly.length}):`);
  directOnly.slice(0, 5).forEach(t => {
    const game = directResults.find((r: any) => r.title.toLowerCase() === t);
    console.log(`   - ${game.title}`);
  });

  return {
    game: game.title,
    tags,
    tagBased: tagResults,
    direct: directResults,
    overlap: overlap.length,
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
      appid: 913740,
      title: "WORLD OF HORROR",
      desc: "Experience the quiet terror of this 1-bit love letter to Junji Ito and H.P. Lovecraft. Investigate eldritch mysteries, carefully manage your resources and battle the cosmic horrors before the Ancient Ones enslave humanity.",
      devs: ["Panstasz"],
    },
    {
      appid: 881100,
      title: "Noita",
      desc: "Noita is a magical action roguelite set in a world where every pixel is physically simulated.",
      devs: ["Nolla Games"],
    },
  ];

  console.log("=".repeat(70));
  console.log("TAG EXPANSION HYPOTHESIS TEST");
  console.log("=".repeat(70));
  console.log("Testing: Tag extraction + search vs Direct search\n");

  const allResults = [];

  for (const game of testGames) {
    const result = await testGame(game);
    allResults.push(result);
    
    if (testGames.indexOf(game) < testGames.length - 1) {
      console.log("\n⏱️  Waiting 2s...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const outputPath = path.resolve(__dirname, `../../results-tag-expansion-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
