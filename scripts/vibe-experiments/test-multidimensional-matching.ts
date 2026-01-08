#!/usr/bin/env npx tsx

/**
 * Test multi-dimensional matching algorithm
 * 
 * Dimensions:
 * - Vibe: emotional tone, pacing, intensity
 * - Aesthetic: visual/audio presentation
 * - Theme: setting, world, narrative
 * - Mechanics: core gameplay loop
 * 
 * Key insight: Vibe is the gatekeeper - wrong vibe = bad match even if mechanics align
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

type GameProfile = {
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
};

type MatchScore = {
  vibeScore: number;
  vibeReason: string;
  aestheticScore: number;
  aestheticReason: string;
  themeScore: number;
  themeReason: string;
  mechanicsScore: number;
  mechanicsReason: string;
};

async function extractGameProfile(title: string, description: string): Promise<GameProfile> {
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Analyze this game and extract its profile across 4 dimensions.

Game: ${title}
Description: ${description}

Return a JSON object with this exact structure:
{
  "vibe": {
    "descriptors": ["3-5 emotional/tonal words like tense, cozy, chaotic, meditative, frantic, melancholic, whimsical, dark, hopeful"],
    "intensity": "low" | "medium" | "high",
    "pacing": "slow" | "medium" | "fast"
  },
  "aesthetic": {
    "visualStyle": "art style description",
    "colorPalette": "dominant colors/mood",
    "audioFeel": "sound/music style"
  },
  "theme": {
    "setting": "world/setting",
    "narrative": "none" | "light" | "heavy",
    "mood": "thematic mood"
  },
  "mechanics": {
    "coreLoop": "main gameplay loop",
    "genre": "genre classification",
    "complexity": "simple" | "medium" | "complex"
  }
}

Return ONLY the JSON, no other text.`,
  });
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in profile response");
  return JSON.parse(match[0]) as GameProfile;
}

async function scoreMatch(
  sourceProfile: GameProfile,
  sourceTitle: string,
  candidateTitle: string,
  candidateDescription: string
): Promise<MatchScore> {
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Score how well this candidate matches the source game across 4 dimensions.

SOURCE GAME: ${sourceTitle}
Source Profile:
- Vibe: ${sourceProfile.vibe.descriptors.join(", ")} (${sourceProfile.vibe.intensity} intensity, ${sourceProfile.vibe.pacing} pacing)
- Aesthetic: ${sourceProfile.aesthetic.visualStyle}, ${sourceProfile.aesthetic.colorPalette}, ${sourceProfile.aesthetic.audioFeel}
- Theme: ${sourceProfile.theme.setting}, ${sourceProfile.theme.mood} (${sourceProfile.theme.narrative} narrative)
- Mechanics: ${sourceProfile.mechanics.coreLoop}, ${sourceProfile.mechanics.genre} (${sourceProfile.mechanics.complexity})

CANDIDATE GAME: ${candidateTitle}
${candidateDescription}

Score each dimension 0-1 based on how similar they FEEL, not just surface features.
A game can have different mechanics but feel similar (high vibe match).
A game can have same mechanics but feel different (low vibe match).

Return JSON:
{
  "vibeScore": 0.0-1.0,
  "vibeReason": "brief explanation",
  "aestheticScore": 0.0-1.0,
  "aestheticReason": "brief explanation",
  "themeScore": 0.0-1.0,
  "themeReason": "brief explanation",
  "mechanicsScore": 0.0-1.0,
  "mechanicsReason": "brief explanation"
}

Return ONLY the JSON, no other text.`,
  });
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in score response");
  return JSON.parse(match[0]) as MatchScore;
}

function calculateFinalScore(scores: MatchScore): { score: number; grade: string; breakdown: string } {
  const { vibeScore, aestheticScore, themeScore, mechanicsScore } = scores;
  
  // Vibe is gatekeeper - if it's too low, tank the score
  if (vibeScore < 0.4) {
    return { 
      score: vibeScore * 0.3, 
      grade: "F",
      breakdown: `Vibe mismatch (${vibeScore.toFixed(2)}) tanks overall score`
    };
  }
  
  // Formula: vibe × aesthetic × (theme + mechanics) / 2
  const themeOrMechanics = (themeScore + mechanicsScore) / 2;
  const finalScore = vibeScore * aestheticScore * themeOrMechanics;
  
  let grade: string;
  if (finalScore >= 0.7) grade = "A";
  else if (finalScore >= 0.5) grade = "B";
  else if (finalScore >= 0.3) grade = "C";
  else if (finalScore >= 0.15) grade = "D";
  else grade = "F";
  
  return {
    score: finalScore,
    grade,
    breakdown: `${vibeScore.toFixed(2)} × ${aestheticScore.toFixed(2)} × (${themeScore.toFixed(2)} + ${mechanicsScore.toFixed(2)})/2 = ${finalScore.toFixed(3)}`
  };
}

async function testGame(appid: number) {
  const supabase = getSupabaseServerClient();
  
  // Get source game
  const { data: source } = await supabase
    .from("games_new")
    .select("appid, title, short_description")
    .eq("appid", appid)
    .single();
  
  if (!source) {
    console.error(`Game ${appid} not found`);
    return;
  }
  
  console.log("=".repeat(80));
  console.log(`SOURCE: ${source.title}`);
  console.log("=".repeat(80));
  console.log(`\n${source.short_description}\n`);
  
  // Extract source profile
  console.log("Extracting game profile...\n");
  const sourceProfile = await extractGameProfile(source.title, source.short_description || "");
  
  console.log("GAME PROFILE:");
  console.log("-".repeat(40));
  console.log(`Vibe: ${sourceProfile.vibe.descriptors.join(", ")}`);
  console.log(`      ${sourceProfile.vibe.intensity} intensity, ${sourceProfile.vibe.pacing} pacing`);
  console.log(`Aesthetic: ${sourceProfile.aesthetic.visualStyle}`);
  console.log(`           ${sourceProfile.aesthetic.colorPalette}, ${sourceProfile.aesthetic.audioFeel}`);
  console.log(`Theme: ${sourceProfile.theme.setting}, ${sourceProfile.theme.mood}`);
  console.log(`       ${sourceProfile.theme.narrative} narrative`);
  console.log(`Mechanics: ${sourceProfile.mechanics.coreLoop}`);
  console.log(`           ${sourceProfile.mechanics.genre}, ${sourceProfile.mechanics.complexity}`);
  
  // Get existing suggestions to score
  const { data: suggestions } = await supabase
    .from("game_suggestions")
    .select("suggested_appid")
    .eq("source_appid", appid)
    .limit(10);
  
  if (!suggestions || suggestions.length === 0) {
    console.log("\nNo existing suggestions to score");
    return;
  }
  
  const suggestionAppids = suggestions.map(s => s.suggested_appid);
  const { data: suggestionGames } = await supabase
    .from("games_new")
    .select("appid, title, short_description")
    .in("appid", suggestionAppids);
  
  console.log(`\n\nSCORING ${suggestionGames?.length || 0} SUGGESTIONS:`);
  console.log("=".repeat(80));
  
  const results: Array<{
    title: string;
    appid: number;
    scores: MatchScore;
    final: { score: number; grade: string; breakdown: string };
  }> = [];
  
  for (const candidate of suggestionGames || []) {
    console.log(`\nScoring: ${candidate.title}...`);
    try {
      const scores = await scoreMatch(
        sourceProfile,
        source.title,
        candidate.title,
        candidate.short_description || ""
      );
      const final = calculateFinalScore(scores);
      results.push({ title: candidate.title, appid: candidate.appid, scores, final });
    } catch (err) {
      console.error(`  Error scoring: ${err}`);
    }
  }
  
  // Sort by final score
  results.sort((a, b) => b.final.score - a.final.score);
  
  console.log("\n\nRESULTS (sorted by multi-dimensional score):");
  console.log("=".repeat(80));
  
  for (const r of results) {
    console.log(`\n[${r.final.grade}] ${r.title} (${r.appid})`);
    console.log(`    Final: ${r.final.breakdown}`);
    console.log(`    Vibe: ${r.scores.vibeScore.toFixed(2)} - ${r.scores.vibeReason}`);
    console.log(`    Aesthetic: ${r.scores.aestheticScore.toFixed(2)} - ${r.scores.aestheticReason}`);
    console.log(`    Theme: ${r.scores.themeScore.toFixed(2)} - ${r.scores.themeReason}`);
    console.log(`    Mechanics: ${r.scores.mechanicsScore.toFixed(2)} - ${r.scores.mechanicsReason}`);
  }
}

// Test games
const TEST_GAMES = [
  4037180, // Go Ape Ship! - frantic co-op
];

async function main() {
  for (const appid of TEST_GAMES) {
    await testGame(appid);
  }
}

main().catch(console.error);
