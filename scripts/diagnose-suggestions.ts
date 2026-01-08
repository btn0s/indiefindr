#!/usr/bin/env npx tsx

/**
 * Diagnostic script to understand what's happening at each step of suggestion generation
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../src/lib/supabase/server";

const KNOWN_ARTGAME_DEVS = [
  "the water museum", "thecatamites", "tale of tales", "ice water games",
  "kittyhorrorshow", "increpare", "molleindustria", "stephen lavelle",
  "nathalie lawhead", "porpentine", "connor sherlock", "cactus", "messhof",
  "droqen", "jonatan söderström", "david o'reilly", "cosmo d",
  "cardboard computer", "variable state", "annapurna interactive", "lmb",
  "sokpop collective", "virtanen",
];

type RawSuggestion = { title: string; reason: string };

async function runStrategy(name: string, prompt: string): Promise<{ suggestions: RawSuggestion[]; raw: string }> {
  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });
    
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { suggestions: [], raw: text };
    
    const parsed = JSON.parse(match[0]) as RawSuggestion[];
    return { suggestions: parsed, raw: text };
  } catch (err) {
    return { suggestions: [], raw: String(err) };
  }
}

async function diagnoseGame(appid: number) {
  const supabase = getSupabaseServerClient();
  
  const { data: game } = await supabase
    .from("games_new")
    .select("appid, title, short_description, developers")
    .eq("appid", appid)
    .single();
  
  if (!game) {
    console.error("Game not found");
    return;
  }
  
  const title = game.title;
  const desc = game.short_description || "";
  const devs: string[] = game.developers || [];
  
  console.log("=".repeat(80));
  console.log("DIAGNOSING:", title);
  console.log("=".repeat(80));
  console.log("\nDescription:", desc);
  console.log("Developers:", devs.join(", ") || "Unknown");
  
  // Step 1: Check game type detection
  console.log("\n" + "=".repeat(80));
  console.log("STEP 1: GAME TYPE DETECTION");
  console.log("=".repeat(80));
  
  const devLower = devs.map(d => d.toLowerCase());
  const isKnownArtDev = KNOWN_ARTGAME_DEVS.some(artDev =>
    devLower.some(d => d.includes(artDev) || artDev.includes(d))
  );
  
  console.log("\nKnown art-game developer?", isKnownArtDev);
  
  if (!isKnownArtDev) {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Classify this game's type in ONE word.

Game: ${title}
Developer: ${devs.join(", ") || "Unknown"}
Description: ${desc}

Types (pick ONE):
- mainstream: Standard game with broad appeal
- avant-garde: Art/experimental game, meaning over mechanics
- cozy: Relaxation-focused, vibe/aesthetic critical
- competitive: Skill/challenge-focused, mechanics paramount
- narrative: Story-driven, theme/emotional journey matter

Also extract 3-5 vibe words.

Return JSON: {"type":"one_type","confidence":0.0-1.0,"vibe":["word1","word2","word3"],"reasoning":"why"}
Return ONLY JSON.`,
    });
    
    console.log("\nAI Classification Response:");
    console.log(text);
  }
  
  // Step 2: Run each strategy separately
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: INDIVIDUAL STRATEGY RESULTS");
  console.log("=".repeat(80));
  
  const devContext = devs.length > 0 ? ` by ${devs.join(", ")}` : "";
  
  // Vibe strategy
  console.log("\n--- VIBE STRATEGY ---");
  const vibePrompt = `Find 12 indie games with the SAME VIBE as "${title}"${devContext}.

Description: ${desc}

Match atmosphere, mood, aesthetic, pacing, emotional tone.
Focus on indie/small studio games. Avoid AAA titles.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it feels similar"}]`;
  
  const vibeResult = await runStrategy("vibe", vibePrompt);
  console.log(`Found ${vibeResult.suggestions.length} suggestions:`);
  vibeResult.suggestions.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.title} - ${s.reason}`);
  });
  
  // Mechanics strategy
  console.log("\n--- MECHANICS STRATEGY ---");
  const mechanicsPrompt = `Find 12 indie games with similar GAMEPLAY to "${title}"${devContext}.

Description: ${desc}

Match core loop, interaction mechanics, control feel, gameplay systems.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why gameplay matches"}]`;
  
  const mechanicsResult = await runStrategy("mechanics", mechanicsPrompt);
  console.log(`Found ${mechanicsResult.suggestions.length} suggestions:`);
  mechanicsResult.suggestions.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.title} - ${s.reason}`);
  });
  
  // Community strategy
  console.log("\n--- COMMUNITY STRATEGY ---");
  const communityPrompt = `Find 12 indie games that fans of "${title}"${devContext} actually recommend.

Description: ${desc}

Look for games the community loves together. Match the overall appeal.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why fans love it"}]`;
  
  const communityResult = await runStrategy("community", communityPrompt);
  console.log(`Found ${communityResult.suggestions.length} suggestions:`);
  communityResult.suggestions.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.title} - ${s.reason}`);
  });
  
  // Step 3: Consensus analysis
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: CONSENSUS ANALYSIS");
  console.log("=".repeat(80));
  
  const combined = new Map<string, { count: number; sources: string[]; reasons: string[] }>();
  
  const addToMap = (suggestions: RawSuggestion[], source: string) => {
    for (const sug of suggestions) {
      const key = sug.title.toLowerCase().trim();
      if (combined.has(key)) {
        const existing = combined.get(key)!;
        existing.count++;
        existing.sources.push(source);
        existing.reasons.push(sug.reason);
      } else {
        combined.set(key, { count: 1, sources: [source], reasons: [sug.reason] });
      }
    }
  };
  
  addToMap(vibeResult.suggestions, "vibe");
  addToMap(mechanicsResult.suggestions, "mechanics");
  addToMap(communityResult.suggestions, "community");
  
  // Sort by consensus
  const sorted = Array.from(combined.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  console.log(`\nTotal unique: ${combined.size}`);
  console.log(`High consensus (2+): ${sorted.filter(([_, v]) => v.count >= 2).length}`);
  console.log(`Mentioned by 3 strategies: ${sorted.filter(([_, v]) => v.count >= 3).length}`);
  
  console.log("\n--- Games by consensus ---");
  sorted.forEach(([title, data]) => {
    const marker = data.count >= 3 ? "🔥" : data.count >= 2 ? "⭐" : "  ";
    console.log(`${marker} [${data.count}/3] ${title}`);
    console.log(`      Sources: ${data.sources.join(", ")}`);
    console.log(`      Reasons: ${data.reasons[0]}`);
  });
  
  // Step 4: Check which made it to final suggestions
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4: FINAL SUGGESTIONS IN DB");
  console.log("=".repeat(80));
  
  const { data: dbSuggestions } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appid);
  
  if (dbSuggestions && dbSuggestions.length > 0) {
    const appids = dbSuggestions.map(s => s.suggested_appid);
    const { data: games } = await supabase
      .from("games_new")
      .select("appid, title")
      .in("appid", appids);
    
    const gameMap = new Map(games?.map(g => [g.appid, g.title]) || []);
    
    console.log(`\n${dbSuggestions.length} suggestions in DB:`);
    dbSuggestions.forEach((s, i) => {
      const sugTitle = gameMap.get(s.suggested_appid) || `AppID ${s.suggested_appid}`;
      const key = sugTitle.toLowerCase();
      const consensusData = combined.get(key);
      const consensus = consensusData?.count || 0;
      const sources = consensusData?.sources?.join(",") || "?";
      
      console.log(`${i+1}. ${sugTitle}`);
      console.log(`   Consensus: ${consensus}/3 (${sources})`);
      console.log(`   Reason: ${s.reason}`);
    });
  } else {
    console.log("\nNo suggestions in DB yet");
  }
}

const appid = parseInt(process.argv[2] || "1833200");
diagnoseGame(appid).catch(console.error);
