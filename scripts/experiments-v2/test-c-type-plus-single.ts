#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";
import { TEST_GAMES, TestGame } from "./shared/test-games";
import { TestResult } from "./shared/output";
import { validateSuggestion, buildGameMap } from "./shared/validate-steam";

type GameType = "mainstream" | "avant-garde" | "cozy" | "competitive" | "narrative" | "action";

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
  "porpentine",
  "connor sherlock",
  "cactus",
  "messhof",
  "droqen",
  "jonatan söderström",
  "david o'reilly",
  "cosmo d",
  "cardboard computer",
  "variable state",
  "annapurna interactive",
  "lmb",
  "sokpop collective",
  "virtanen",
];

function checkKnownArtDev(developers: string[]): boolean {
  const devLower = developers.map((d) => d.toLowerCase());
  return KNOWN_ARTGAME_DEVS.some((artDev) =>
    devLower.some((d) => d.includes(artDev) || artDev.includes(d))
  );
}

async function detectGameType(
  title: string,
  description: string,
  developers: string[]
): Promise<{ type: GameType; vibe: string[] }> {
  const isKnownArtDev = checkKnownArtDev(developers);

  if (isKnownArtDev) {
    return {
      type: "avant-garde",
      vibe: ["experimental", "artistic", "unconventional"],
    };
  }

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Read this game description carefully and identify its EMOTIONAL TONE and VIBE.

Game: ${title}
Developer: ${developers.join(", ") || "Unknown"}
Description: ${description}

IMPORTANT: Read the TONE of the writing, not just keywords.
- "gigantic crustacean festooned with cannons" = WHIMSICAL, QUIRKY, CHARMING (not "shooter")
- "harrowing descent into madness" = DARK, TENSE, PSYCHOLOGICAL
- "cozy cafe where you serve magical creatures" = WHOLESOME, RELAXING, COZY
- "brutal roguelike where death comes fast" = INTENSE, PUNISHING, ADRENALINE

Don't assume mechanics = vibe:
- "coop" doesn't mean chaotic (could be cozy coop like Stardew)
- "cannons" doesn't mean shooter (could be whimsical like pirates)
- "combat" doesn't mean intense (could be playful)

Types (pick ONE based on CORE GAMEPLAY, not story framing):
- action: Combat/shooter/fighting is the CORE loop. Keywords: guns, shooting, combat, fighting, tactical, battle. A game with story BUT guns-blazing gameplay = action, NOT narrative.
- narrative: Story IS the gameplay (visual novels, walking sims, dialogue RPGs). Combat-focused games with dark stories are still ACTION.
- cozy: Relaxation-focused, vibe/aesthetic critical
- competitive: Skill/challenge-focused (speedrun, esport, precision)
- avant-garde: Art/experimental, meaning over mechanics
- mainstream: Standard game that doesn't fit above categories

Extract 3-5 vibe words that capture the FEELING/TONE:
whimsical, quirky, charming, adventurous, imaginative, cozy, relaxing, tense, dark, melancholic, intense, frantic, chaotic, serene, meditative, playful, wholesome, mysterious, eerie, epic, silly, heartfelt, bittersweet, lonely, hopeful

Return JSON: {"type":"one_type","vibe":["word1","word2","word3"]}
Return ONLY JSON.`,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        type: parsed.type as GameType,
        vibe: parsed.vibe || [],
      };
    }
  } catch (err) {
    console.error("Game type detection failed:", err);
  }

  return {
    type: "mainstream",
    vibe: [],
  };
}

function buildStrategyPrompt(
  type: GameType,
  vibe: string[],
  title: string,
  description: string,
  developers: string[],
  count: number
): string {
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";
  const vibeContext = vibe.length > 0 ? ` Vibe: ${vibe.join(", ")}.` : "";

  switch (type) {
    case "action":
      return `Find ${count} ACTION/COMBAT indie games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is an ACTION game. Find games that:
- Have similar combat/shooting/fighting mechanics
- Match the intensity and pace
- Have similar tactical depth
- Match the tone (dark action vs light action)

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

    case "narrative":
      return `Find ${count} STORY-DRIVEN games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is a NARRATIVE game. Find games that:
- Have similar themes and emotional journeys
- Strong narrative focus
- Character-driven experiences
- Match the tone and storytelling style

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

    case "cozy":
      return `Find ${count} COZY/RELAXING indie games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is a COZY game. Find games that:
- Are relaxing, gentle, comforting
- Have similar calming aesthetics
- Match the peaceful, low-stress mood

Do NOT suggest stressful or intense games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

    case "avant-garde":
      return `Find ${count} EXPERIMENTAL/AVANT-GARDE indie games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is an ART GAME. Find games that:
- Are weird, surreal, experimental, unconventional
- Prioritize artistic expression or emotional experience over gameplay
- Come from the indie/art game scene
- Would appeal to players who like bizarre, thoughtful, boundary-pushing games

Do NOT suggest mainstream games. Only WEIRD/EXPERIMENTAL games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

    case "competitive":
      return `Find ${count} games with SIMILAR GAMEPLAY MECHANICS to "${title}"${devContext}.

Description: ${description}

This is a SKILL-BASED game. Find games that:
- Have similar mechanical depth and challenge
- Match the core gameplay loop and systems
- Appeal to players who enjoy mastery and skill expression
- Have similar strategic/tactical depth

Focus on MECHANICAL SIMILARITY above all else.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

    default: // mainstream
      const vibeList = vibe.length > 0 ? vibe.join(", ") : "adventurous";
      return `Find ${count} indie games that FEEL like "${title}"${devContext}.

Description: ${description}

This game's vibe is: ${vibeList}

Find games with the SAME EMOTIONAL TONE - not just similar mechanics.
Match: atmosphere, tone, aesthetic, the FEELING of playing.
Focus on indie/small studio games. Avoid AAA titles.

Write SHORT reasons (under 15 words) about WHY it feels similar.
Return ONLY JSON: [{"title":"Game Name","reason":"Why it feels similar"}]`;
  }
}

export async function runTypePlusSingleTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabaseServerClient();
  const gameMap = await buildGameMap(supabase);

  for (const game of TEST_GAMES) {
    const startTime = Date.now();

    // Step 1: Detect game type
    const profile = await detectGameType(game.title, game.description, []);

    // Step 2: Build and run single strategy based on type
    const prompt = buildStrategyPrompt(
      profile.type,
      profile.vibe,
      game.title,
      game.description,
      [],
      10
    );

    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });

    // Parse JSON from response
    let suggestions: Array<{ title: string; reason: string }> = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error(`Failed to parse JSON for ${game.title}:`, e);
    }

    // Step 3: Validate against Steam
    const validatedSuggestions = await Promise.all(
      suggestions.map(async (s) => {
        const validation = await validateSuggestion(s.title, gameMap);
        return {
          title: s.title,
          appid: validation.appid,
          reason: s.reason,
        };
      })
    );

    const timing = Date.now() - startTime;

    results.push({
      testName: "Test C (Type+Single)",
      gameTitle: game.title,
      suggestions: validatedSuggestions.slice(0, 10),
      timing,
    });
  }

  return results;
}

if (require.main === module) {
  runTypePlusSingleTest()
    .then((results) => {
      console.log("Test C (Type+Single) Results:");
      console.log("=".repeat(60));
      for (const result of results) {
        console.log(`\n${result.gameTitle}:`);
        console.log(`Time: ${result.timing}ms`);
        console.log(`Suggestions: ${result.suggestions.length}`);
        result.suggestions.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.title}${s.appid ? ` (${s.appid})` : ""}`);
        });
      }
    })
    .catch(console.error);
}
