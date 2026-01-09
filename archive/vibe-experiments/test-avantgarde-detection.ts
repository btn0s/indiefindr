#!/usr/bin/env npx tsx

/**
 * Test avant-garde/experimental game detection
 * 
 * The problem: Short descriptions don't capture "weirdness"
 * 
 * Signals we can use:
 * 1. Developer reputation (known art game developers)
 * 2. Description keywords ("experimental", "surreal", "abstract", etc.)
 * 3. Short description brevity (avant-garde games often have cryptic descriptions)
 * 4. Tag signals if available
 * 5. AI analysis with explicit prompting for unconventional games
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";

// Known avant-garde/art game developers
const KNOWN_ARTGAME_DEVS = [
  "the water museum",
  "thecatamites", 
  "tale of tales",
  "ice water games",
  "kittyhorrorshow",
  "increpare",
  "molleindustria",
  "stephen lavelle",
  "nathalie lawhead",
  "thecatamites",
  "porpentine",
  "connor sherlock",
  "free lives",
  "cactus",
  "messhof",
  "droqen",
  "jonatan söderström",
];

// Keywords that suggest experimental/avant-garde nature
const AVANTGARDE_KEYWORDS = [
  "experimental", "surreal", "abstract", "artistic", "unconventional",
  "strange", "weird", "dreamlike", "meditative", "contemplative",
  "poetic", "avant-garde", "art game", "interactive fiction",
  "walking simulator", "experience", "journey", "explore",
  "minimalist", "atmospheric", "introspective", "ethereal",
];

type AvantGardeSignals = {
  developerSignal: { score: number; reason: string };
  keywordSignal: { score: number; keywords: string[] };
  brevitySignal: { score: number; reason: string };
  aiSignal: { score: number; reasoning: string };
  overallScore: number;
  isAvantGarde: boolean;
  recommendedWeights: {
    vibe: number;
    aesthetic: number;
    theme: number;
    mechanics: number;
    artistry: number;
  };
};

async function detectAvantGardeSignals(
  title: string,
  description: string,
  developers: string[]
): Promise<AvantGardeSignals> {
  
  // 1. Developer signal
  const devLower = developers.map(d => d.toLowerCase());
  const knownArtDev = KNOWN_ARTGAME_DEVS.find(dev => 
    devLower.some(d => d.includes(dev) || dev.includes(d))
  );
  const developerSignal = {
    score: knownArtDev ? 0.9 : 0.0,
    reason: knownArtDev ? `Known art game developer: ${knownArtDev}` : "Unknown developer",
  };
  
  // 2. Keyword signal
  const descLower = description.toLowerCase();
  const foundKeywords = AVANTGARDE_KEYWORDS.filter(kw => descLower.includes(kw));
  const keywordSignal = {
    score: Math.min(foundKeywords.length * 0.2, 0.8),
    keywords: foundKeywords,
  };
  
  // 3. Brevity signal (avant-garde games often have cryptic short descriptions)
  const wordCount = description.split(/\s+/).length;
  const brevitySignal = {
    score: wordCount < 20 ? 0.3 : wordCount < 40 ? 0.15 : 0,
    reason: `${wordCount} words (${wordCount < 20 ? "very short - possibly cryptic" : wordCount < 40 ? "short" : "normal"})`,
  };
  
  // 4. AI signal - explicitly ask about experimental nature
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `Analyze this game for EXPERIMENTAL or AVANT-GARDE qualities.

Game: ${title}
Developer: ${developers.join(", ")}
Description: ${description}

Consider:
- Is this an "art game" or experimental game?
- Does it seem to prioritize meaning/experience over traditional gameplay?
- Is it unconventional, surreal, or abstract?
- Would it appeal to players who like weird/experimental games?

Return JSON:
{
  "isExperimental": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "why you think this",
  "comparisonGames": ["list of similar experimental games if applicable"]
}

Return ONLY JSON.`,
  });
  
  let aiResult = { isExperimental: false, confidence: 0, reasoning: "parse error", comparisonGames: [] };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) aiResult = JSON.parse(match[0]);
  } catch (e) {}
  
  const aiSignal = {
    score: aiResult.isExperimental ? aiResult.confidence : 0,
    reasoning: aiResult.reasoning,
  };
  
  // Calculate overall score
  const weights = { dev: 0.4, keyword: 0.2, brevity: 0.1, ai: 0.3 };
  const overallScore = 
    (developerSignal.score * weights.dev) +
    (keywordSignal.score * weights.keyword) +
    (brevitySignal.score * weights.brevity) +
    (aiSignal.score * weights.ai);
  
  const isAvantGarde = overallScore > 0.4;
  
  // Recommended weights based on avant-garde detection
  const recommendedWeights = isAvantGarde ? {
    vibe: 0.35,
    aesthetic: 0.25,
    theme: 0.15,
    mechanics: 0.05,
    artistry: 0.20,
  } : {
    vibe: 0.30,
    aesthetic: 0.25,
    theme: 0.20,
    mechanics: 0.25,
    artistry: 0.00,
  };
  
  return {
    developerSignal,
    keywordSignal,
    brevitySignal,
    aiSignal,
    overallScore,
    isAvantGarde,
    recommendedWeights,
  };
}

async function generateAvantGardeSuggestions(
  title: string,
  description: string,
  developers: string[]
): Promise<Array<{ title: string; reason: string }>> {
  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find 10 EXPERIMENTAL/AVANT-GARDE indie games similar to "${title}" by ${developers.join(", ")}.

Description: ${description}

This is an ART GAME or EXPERIMENTAL game. Find other games that:
- Are also weird, surreal, experimental, or unconventional
- Prioritize artistic expression or emotional experience over gameplay
- Come from the indie/art game scene
- Would appeal to the same audience that likes bizarre, thoughtful, or boundary-pushing games

Do NOT suggest:
- Mainstream games (even if they share themes)
- Games that are just "cozy" or "relaxing" - they must be WEIRD
- Photography games (unless they're also experimental/weird)

Think: what would a fan of experimental art games enjoy?

Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches the weird/experimental vibe"}]`,
  });
  
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {}
  return [];
}

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
  console.log(`\nDescription: ${game.short_description}\n`);
  
  // Detect avant-garde signals
  console.log("DETECTING AVANT-GARDE SIGNALS...\n");
  const signals = await detectAvantGardeSignals(
    game.title,
    game.short_description || "",
    game.developers || []
  );
  
  console.log(`Developer Signal: ${(signals.developerSignal.score * 100).toFixed(0)}%`);
  console.log(`  → ${signals.developerSignal.reason}`);
  console.log(`Keyword Signal: ${(signals.keywordSignal.score * 100).toFixed(0)}%`);
  console.log(`  → Found: ${signals.keywordSignal.keywords.join(", ") || "none"}`);
  console.log(`Brevity Signal: ${(signals.brevitySignal.score * 100).toFixed(0)}%`);
  console.log(`  → ${signals.brevitySignal.reason}`);
  console.log(`AI Signal: ${(signals.aiSignal.score * 100).toFixed(0)}%`);
  console.log(`  → ${signals.aiSignal.reasoning}`);
  console.log();
  console.log(`OVERALL SCORE: ${(signals.overallScore * 100).toFixed(0)}%`);
  console.log(`IS AVANT-GARDE: ${signals.isAvantGarde ? "YES ✨" : "NO"}`);
  
  if (signals.isAvantGarde) {
    console.log("\nRECOMMENDED WEIGHTS FOR MATCHING:");
    console.log(`  Vibe: ${(signals.recommendedWeights.vibe * 100).toFixed(0)}%`);
    console.log(`  Aesthetic: ${(signals.recommendedWeights.aesthetic * 100).toFixed(0)}%`);
    console.log(`  Theme: ${(signals.recommendedWeights.theme * 100).toFixed(0)}%`);
    console.log(`  Mechanics: ${(signals.recommendedWeights.mechanics * 100).toFixed(0)}%`);
    console.log(`  Artistry: ${(signals.recommendedWeights.artistry * 100).toFixed(0)}%`);
    
    // Generate avant-garde specific suggestions
    console.log("\n" + "-".repeat(40));
    console.log("GENERATING AVANT-GARDE SUGGESTIONS...\n");
    const suggestions = await generateAvantGardeSuggestions(
      game.title,
      game.short_description || "",
      game.developers || []
    );
    
    console.log(`Found ${suggestions.length} suggestions:\n`);
    suggestions.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title}`);
      console.log(`   → ${s.reason}`);
    });
  }
  
  return signals;
}

// Test games
const TEST_GAMES = [
  2662730,   // Eating Nature - by The Water Museum
  4037180,   // Go Ape Ship! - mainstream co-op
  2379780,   // Balatro - card roguelike
];

async function main() {
  console.log("AVANT-GARDE DETECTION TEST\n");
  
  for (const appid of TEST_GAMES) {
    await testGame(appid);
    console.log("\n\n");
  }
}

main().catch(console.error);
