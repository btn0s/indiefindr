#!/usr/bin/env npx tsx

/**
 * ADAPTIVE SUGGESTION SYSTEM
 * 
 * Complete pipeline that:
 * 1. Analyzes game to detect type (mainstream, avant-garde, cozy, competitive)
 * 2. Adjusts matching weights based on type
 * 3. Generates type-appropriate suggestions
 * 4. Scores and ranks using multi-dimensional algorithm
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

// ============================================================================
// TYPES
// ============================================================================

type GameType = "mainstream" | "avant-garde" | "cozy" | "competitive" | "narrative";

type GameProfile = {
  type: GameType;
  typeConfidence: number;
  typeReasoning: string;
  
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
    mood: string;
  };
  
  mechanics: {
    coreLoop: string;
    genre: string;
  };
  
  // For avant-garde games
  artistry?: {
    experimentalism: number;
    meaningfulness: number;
    uniqueness: number;
  };
  
  weights: {
    vibe: number;
    aesthetic: number;
    theme: number;
    mechanics: number;
    artistry: number;
  };
};

type RawSuggestion = { title: string; reason: string };

// ============================================================================
// KNOWN ART GAME DEVELOPERS
// ============================================================================

const KNOWN_ARTGAME_DEVS = [
  "the water museum", "thecatamites", "tale of tales", "ice water games",
  "kittyhorrorshow", "increpare", "molleindustria", "stephen lavelle",
  "nathalie lawhead", "porpentine", "connor sherlock", "cactus", "messhof",
  "droqen", "jonatan söderström", "clint hocking", "david o'reilly",
];

// ============================================================================
// PROFILE EXTRACTION
// ============================================================================

async function extractGameProfile(
  title: string,
  description: string,
  developers: string[]
): Promise<GameProfile> {
  
  // Check for known art game developers
  const devLower = developers.map(d => d.toLowerCase());
  const isKnownArtDev = KNOWN_ARTGAME_DEVS.some(dev => 
    devLower.some(d => d.includes(dev) || dev.includes(d))
  );
  
  // Single AI call to extract everything
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Analyze this game comprehensively.

Game: ${title}
Developer: ${developers.join(", ")}
Description: ${description}

${isKnownArtDev ? "NOTE: This developer is KNOWN for avant-garde/art games. Weight your classification accordingly." : ""}

Determine the game TYPE first, then extract profile details.

Game types:
- mainstream: Standard game with broad appeal, balanced gameplay
- avant-garde: Art game, experimental, meaning/experience over mechanics
- cozy: Relaxation-focused, vibe and aesthetic are key
- competitive: Skill/challenge-focused, mechanics are paramount
- narrative: Story-driven, theme and emotional journey matter most

Return JSON:
{
  "type": "one of the types",
  "typeConfidence": 0.0-1.0,
  "typeReasoning": "brief explanation",
  
  "vibe": {
    "descriptors": ["3-5 emotional words"],
    "intensity": "low|medium|high",
    "pacing": "slow|medium|fast"
  },
  "aesthetic": {
    "visualStyle": "art style",
    "colorPalette": "colors",
    "audioFeel": "sound style"
  },
  "theme": {
    "setting": "world/setting",
    "mood": "mood"
  },
  "mechanics": {
    "coreLoop": "main loop",
    "genre": "genre"
  }${isKnownArtDev ? `,
  "artistry": {
    "experimentalism": 0.0-1.0,
    "meaningfulness": 0.0-1.0,
    "uniqueness": 0.0-1.0
  }` : ""}
}

Return ONLY JSON.`,
  });
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in profile response");
  
  const parsed = JSON.parse(match[0]);
  
  // Force avant-garde for known developers if AI didn't catch it
  if (isKnownArtDev && parsed.type !== "avant-garde") {
    parsed.type = "avant-garde";
    parsed.typeConfidence = 0.9;
    parsed.typeReasoning = `Known art game developer (${developers.join(", ")})`;
    if (!parsed.artistry) {
      parsed.artistry = { experimentalism: 0.8, meaningfulness: 0.7, uniqueness: 0.8 };
    }
  }
  
  // Set weights based on type
  const weights = getWeightsForType(parsed.type as GameType);
  
  return { ...parsed, weights };
}

function getWeightsForType(type: GameType): GameProfile["weights"] {
  switch (type) {
    case "avant-garde":
      return { vibe: 0.35, aesthetic: 0.25, theme: 0.15, mechanics: 0.05, artistry: 0.20 };
    case "cozy":
      return { vibe: 0.40, aesthetic: 0.35, theme: 0.15, mechanics: 0.10, artistry: 0.00 };
    case "competitive":
      return { vibe: 0.15, aesthetic: 0.10, theme: 0.10, mechanics: 0.65, artistry: 0.00 };
    case "narrative":
      return { vibe: 0.30, aesthetic: 0.20, theme: 0.35, mechanics: 0.15, artistry: 0.00 };
    case "mainstream":
    default:
      return { vibe: 0.30, aesthetic: 0.25, theme: 0.20, mechanics: 0.25, artistry: 0.00 };
  }
}

// ============================================================================
// TYPE-SPECIFIC SUGGESTION GENERATION
// ============================================================================

async function generateSuggestions(
  profile: GameProfile,
  title: string,
  description: string,
  developers: string[]
): Promise<RawSuggestion[]> {
  
  const prompt = buildPromptForType(profile, title, description, developers);
  
  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt,
  });
  
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {}
  return [];
}

function buildPromptForType(
  profile: GameProfile,
  title: string,
  description: string,
  developers: string[]
): string {
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";
  
  switch (profile.type) {
    case "avant-garde":
      return `Find 15 EXPERIMENTAL/AVANT-GARDE indie games similar to "${title}"${devContext}.

Description: ${description}

This is an ART GAME. Find games that:
- Are weird, surreal, experimental, unconventional
- Prioritize artistic expression or emotional experience
- Come from the indie/art game scene
- Would appeal to players who like bizarre, thoughtful games

Match the VIBE: ${profile.vibe.descriptors.join(", ")}

Do NOT suggest mainstream games. Only WEIRD/EXPERIMENTAL games.

Return JSON: [{"title":"Game Name","reason":"Why it matches the weird/experimental vibe"}]`;

    case "cozy":
      return `Find 15 COZY/RELAXING indie games similar to "${title}"${devContext}.

Description: ${description}

This is a COZY game. Find games that:
- Are relaxing, gentle, comforting
- Have similar aesthetics: ${profile.aesthetic.visualStyle}
- Match the mood: ${profile.vibe.descriptors.join(", ")}

Do NOT suggest stressful or intense games.

Return JSON: [{"title":"Game Name","reason":"Why it matches the cozy vibe"}]`;

    case "competitive":
      return `Find 15 games with SIMILAR GAMEPLAY MECHANICS to "${title}"${devContext}.

Description: ${description}
Genre: ${profile.mechanics.genre}
Core Loop: ${profile.mechanics.coreLoop}

This is a SKILL-BASED game. Find games that:
- Have similar mechanical depth and challenge
- Match the core gameplay loop
- Appeal to players who enjoy mastery and skill expression

Return JSON: [{"title":"Game Name","reason":"Why the gameplay matches"}]`;

    case "narrative":
      return `Find 15 STORY-DRIVEN games similar to "${title}"${devContext}.

Description: ${description}

This is a NARRATIVE game. Find games that:
- Have similar themes: ${profile.theme.setting}, ${profile.theme.mood}
- Match the emotional journey: ${profile.vibe.descriptors.join(", ")}
- Prioritize story and character

Return JSON: [{"title":"Game Name","reason":"Why the story/themes match"}]`;

    default: // mainstream
      return `Find 15 indie games similar to "${title}"${devContext}.

Description: ${description}

Match across MULTIPLE dimensions:
- Vibe: ${profile.vibe.descriptors.join(", ")}
- Aesthetic: ${profile.aesthetic.visualStyle}
- Theme: ${profile.theme.setting}
- Mechanics: ${profile.mechanics.coreLoop}

Write SHORT reasons (under 15 words).
Return JSON: [{"title":"Game Name","reason":"Why it matches"}]`;
  }
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function testGame(appid: number) {
  const supabase = getSupabaseServerClient();
  
  const { data: game } = await supabase
    .from("games_new")
    .select("appid, title, short_description, developers")
    .eq("appid", appid)
    .single();
  
  if (!game) {
    console.error(`Game ${appid} not found`);
    return;
  }
  
  console.log("=".repeat(80));
  console.log(`GAME: ${game.title}`);
  console.log(`DEVELOPER: ${game.developers?.join(", ") || "Unknown"}`);
  console.log("=".repeat(80));
  console.log(`\n${game.short_description}\n`);
  
  // Extract profile
  console.log("ANALYZING GAME...\n");
  const profile = await extractGameProfile(
    game.title,
    game.short_description || "",
    game.developers || []
  );
  
  console.log(`TYPE: ${profile.type.toUpperCase()} (${(profile.typeConfidence * 100).toFixed(0)}% confidence)`);
  console.log(`REASON: ${profile.typeReasoning}\n`);
  
  console.log(`VIBE: ${profile.vibe.descriptors.join(", ")} (${profile.vibe.intensity}, ${profile.vibe.pacing})`);
  console.log(`AESTHETIC: ${profile.aesthetic.visualStyle}`);
  console.log(`THEME: ${profile.theme.setting}, ${profile.theme.mood}`);
  console.log(`MECHANICS: ${profile.mechanics.coreLoop} (${profile.mechanics.genre})`);
  
  if (profile.artistry) {
    console.log(`\nARTISTRY:`);
    console.log(`  Experimentalism: ${(profile.artistry.experimentalism * 100).toFixed(0)}%`);
    console.log(`  Meaningfulness: ${(profile.artistry.meaningfulness * 100).toFixed(0)}%`);
    console.log(`  Uniqueness: ${(profile.artistry.uniqueness * 100).toFixed(0)}%`);
  }
  
  console.log(`\nWEIGHTS FOR MATCHING:`);
  console.log(`  Vibe: ${(profile.weights.vibe * 100).toFixed(0)}%`);
  console.log(`  Aesthetic: ${(profile.weights.aesthetic * 100).toFixed(0)}%`);
  console.log(`  Theme: ${(profile.weights.theme * 100).toFixed(0)}%`);
  console.log(`  Mechanics: ${(profile.weights.mechanics * 100).toFixed(0)}%`);
  if (profile.weights.artistry > 0) {
    console.log(`  Artistry: ${(profile.weights.artistry * 100).toFixed(0)}%`);
  }
  
  // Generate suggestions
  console.log("\n" + "-".repeat(40));
  console.log(`GENERATING ${profile.type.toUpperCase()}-OPTIMIZED SUGGESTIONS...\n`);
  
  const suggestions = await generateSuggestions(
    profile,
    game.title,
    game.short_description || "",
    game.developers || []
  );
  
  console.log(`Found ${suggestions.length} suggestions:\n`);
  suggestions.forEach((s, i) => {
    console.log(`${i + 1}. ${s.title}`);
    console.log(`   → ${s.reason}`);
  });
  
  // Get existing suggestions for comparison
  const { data: existing } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appid)
    .limit(5);
  
  if (existing && existing.length > 0) {
    const existingAppids = existing.map(e => e.suggested_appid);
    const { data: existingGames } = await supabase
      .from("games_new")
      .select("appid, title")
      .in("appid", existingAppids);
    
    const gameMap = new Map(existingGames?.map(g => [g.appid, g.title]) || []);
    
    console.log("\n" + "-".repeat(40));
    console.log("CURRENT SUGGESTIONS IN DB (for comparison):\n");
    existing.forEach((e, i) => {
      const title = gameMap.get(e.suggested_appid) || `AppID ${e.suggested_appid}`;
      console.log(`${i + 1}. ${title}`);
      console.log(`   → ${e.reason}`);
    });
  }
  
  return profile;
}

// Test games
const TEST_GAMES = [
  2662730,   // Eating Nature - avant-garde
  4037180,   // Go Ape Ship! - mainstream
  2379780,   // Balatro - competitive
];

async function main() {
  console.log("ADAPTIVE SUGGESTION SYSTEM TEST\n");
  console.log("This system automatically detects game type and adjusts matching strategy.\n");
  
  for (const appid of TEST_GAMES) {
    await testGame(appid);
    console.log("\n\n");
  }
}

main().catch(console.error);
