#!/usr/bin/env npx tsx

/**
 * Test dynamic weight adjustment based on game "type"
 * 
 * Different games need different matching strategies:
 * - Mainstream: balanced weights
 * - Avant-garde/Art: artistry > mechanics
 * - Cozy/Vibe: aesthetic + vibe > mechanics
 * - Hardcore/Competitive: mechanics > aesthetic
 * 
 * The goal: auto-detect game type and adjust algorithm accordingly
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

type GameType = {
  primaryType: "mainstream" | "avant-garde" | "cozy" | "competitive" | "narrative" | "experimental";
  confidence: number;
  reasoning: string;
  suggestedWeights: {
    vibe: number;
    aesthetic: number;
    theme: number;
    mechanics: number;
  };
  matchingStrategy: string;
};

type ExtendedProfile = {
  vibe: {
    descriptors: string[];
    intensity: "low" | "medium" | "high";
    pacing: "slow" | "medium" | "fast";
  };
  aesthetic: {
    visualStyle: string;
    colorPalette: string;
    audioFeel: string;
  };
  theme: {
    setting: string;
    narrative: "none" | "light" | "heavy";
    mood: string;
  };
  mechanics: {
    coreLoop: string;
    genre: string;
    complexity: "simple" | "medium" | "complex";
  };
  artistry?: {
    experimentalism: number;
    meaningfulness: number;
    uniqueness: number;
    emotionalDepth: number;
  };
};

async function classifyGameType(title: string, description: string): Promise<GameType> {
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Classify this game's type to determine the best matching strategy.

Game: ${title}
Description: ${description}

Game types:
- mainstream: Standard game with broad appeal, balanced matching works
- avant-garde: Art game, experimental, meaning matters more than mechanics
- cozy: Relaxation-focused, vibe and aesthetic are critical
- competitive: Skill/challenge-focused, mechanics are paramount
- narrative: Story-driven, theme and emotional journey matter most
- experimental: Weird/unique mechanics, gameplay innovation is key

Return JSON:
{
  "primaryType": "one of the types above",
  "confidence": 0.0-1.0,
  "reasoning": "why this classification",
  "suggestedWeights": {
    "vibe": 0.0-1.0,
    "aesthetic": 0.0-1.0,
    "theme": 0.0-1.0,
    "mechanics": 0.0-1.0
  },
  "matchingStrategy": "how to find good matches for this type"
}

Weights should sum to roughly 1.0.
Examples:
- avant-garde: { vibe: 0.4, aesthetic: 0.3, theme: 0.25, mechanics: 0.05 }
- competitive: { vibe: 0.15, aesthetic: 0.1, theme: 0.1, mechanics: 0.65 }
- cozy: { vibe: 0.4, aesthetic: 0.35, theme: 0.15, mechanics: 0.1 }

Return ONLY the JSON, no other text.`,
  });
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in classification response");
  return JSON.parse(match[0]) as GameType;
}

async function extractExtendedProfile(
  title: string, 
  description: string,
  gameType: GameType
): Promise<ExtendedProfile> {
  const needsArtistry = ["avant-garde", "narrative", "experimental"].includes(gameType.primaryType);
  
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Analyze this game and extract its profile.

Game: ${title}
Description: ${description}
Detected Type: ${gameType.primaryType}

${needsArtistry ? `
This is an artistic/experimental game. Include the "artistry" section with scores 0-1 for:
- experimentalism: How experimental/unconventional
- meaningfulness: Depth of meaning/message
- uniqueness: How unique/unprecedented
- emotionalDepth: Emotional resonance
` : "Do NOT include an artistry section."}

Return JSON:
{
  "vibe": {
    "descriptors": ["3-5 emotional/tonal words"],
    "intensity": "low" | "medium" | "high",
    "pacing": "slow" | "medium" | "fast"
  },
  "aesthetic": {
    "visualStyle": "art style",
    "colorPalette": "colors/mood",
    "audioFeel": "sound style"
  },
  "theme": {
    "setting": "world/setting",
    "narrative": "none" | "light" | "heavy",
    "mood": "thematic mood"
  },
  "mechanics": {
    "coreLoop": "main loop",
    "genre": "genre",
    "complexity": "simple" | "medium" | "complex"
  }${needsArtistry ? `,
  "artistry": {
    "experimentalism": 0.0-1.0,
    "meaningfulness": 0.0-1.0,
    "uniqueness": 0.0-1.0,
    "emotionalDepth": 0.0-1.0
  }` : ""}
}

Return ONLY the JSON, no other text.`,
  });
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in profile response");
  return JSON.parse(match[0]) as ExtendedProfile;
}

async function testGame(appid: number, expectedType: string) {
  const supabase = getSupabaseServerClient();
  
  const { data: game } = await supabase
    .from("games_new")
    .select("appid, title, short_description")
    .eq("appid", appid)
    .single();
  
  if (!game) {
    console.error(`Game ${appid} not found`);
    return null;
  }
  
  console.log("\n" + "=".repeat(80));
  console.log(`GAME: ${game.title}`);
  console.log("=".repeat(80));
  console.log(`\n${game.short_description}\n`);
  
  // Step 1: Classify game type
  console.log("Step 1: Classifying game type...\n");
  const gameType = await classifyGameType(game.title, game.short_description || "");
  
  console.log(`TYPE: ${gameType.primaryType} (${(gameType.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`EXPECTED: ${expectedType} ${gameType.primaryType === expectedType ? "✅" : "⚠️"}`);
  console.log(`REASONING: ${gameType.reasoning}`);
  console.log(`\nSUGGESTED WEIGHTS:`);
  console.log(`  Vibe: ${(gameType.suggestedWeights.vibe * 100).toFixed(0)}%`);
  console.log(`  Aesthetic: ${(gameType.suggestedWeights.aesthetic * 100).toFixed(0)}%`);
  console.log(`  Theme: ${(gameType.suggestedWeights.theme * 100).toFixed(0)}%`);
  console.log(`  Mechanics: ${(gameType.suggestedWeights.mechanics * 100).toFixed(0)}%`);
  console.log(`\nMATCHING STRATEGY: ${gameType.matchingStrategy}`);
  
  // Step 2: Extract extended profile
  console.log("\n" + "-".repeat(40));
  console.log("Step 2: Extracting extended profile...\n");
  const profile = await extractExtendedProfile(game.title, game.short_description || "", gameType);
  
  console.log(`VIBE: ${profile.vibe.descriptors.join(", ")}`);
  console.log(`      ${profile.vibe.intensity} intensity, ${profile.vibe.pacing} pacing`);
  console.log(`AESTHETIC: ${profile.aesthetic.visualStyle}, ${profile.aesthetic.colorPalette}`);
  console.log(`THEME: ${profile.theme.setting}, ${profile.theme.mood}`);
  console.log(`MECHANICS: ${profile.mechanics.coreLoop} (${profile.mechanics.genre})`);
  
  if (profile.artistry) {
    console.log(`\nARTISTRY SCORES:`);
    console.log(`  Experimentalism: ${(profile.artistry.experimentalism * 100).toFixed(0)}%`);
    console.log(`  Meaningfulness: ${(profile.artistry.meaningfulness * 100).toFixed(0)}%`);
    console.log(`  Uniqueness: ${(profile.artistry.uniqueness * 100).toFixed(0)}%`);
    console.log(`  Emotional Depth: ${(profile.artistry.emotionalDepth * 100).toFixed(0)}%`);
  }
  
  return { gameType, profile };
}

// Test games across different types
const TEST_GAMES = [
  { appid: 4037180, expected: "mainstream" },      // Go Ape Ship! - frantic co-op
  { appid: 2379780, expected: "mainstream" },      // Balatro - card roguelike
  { appid: 2662730, expected: "avant-garde" },     // Eating Nature - art game
];

async function main() {
  console.log("TESTING DYNAMIC WEIGHT DETECTION");
  console.log("=".repeat(80));
  
  for (const test of TEST_GAMES) {
    try {
      await testGame(test.appid, test.expected);
    } catch (err) {
      console.error(`Error testing ${test.appid}: ${err}`);
    }
    console.log("\n");
  }
}

main().catch(console.error);
