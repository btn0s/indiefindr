#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";
import { TEST_GAMES, TestGame } from "./shared/test-games";
import { TestResult } from "./shared/output";
import { validateSuggestion, buildGameMap } from "./shared/validate-steam";

export async function runExamplesInPromptTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabaseServerClient();
  const gameMap = await buildGameMap(supabase);

  for (const game of TEST_GAMES) {
    const startTime = Date.now();

    const prompt = `Find games similar to "${game.title}".

IMPORTANT - Match the RIGHT dimension. Here are examples of correct matching:

- "guns-blazing, tactical" -> ULTRAKILL, Severed Steel (NOT sad narrative games)
- "gigantic crustacean with cannons" -> Sail Forth, Lovers in a Dangerous Spacetime (whimsical, NOT shooters)
- "decide who lives or dies" -> Papers Please, Death and Taxes (bureaucratic moral, NOT action)
- "frantic co-op multiplayer" -> Overcooked, Moving Out (party chaos, NOT solo games)
- "dark story WITH guns" -> action shooters with dark tone (NOT narrative games)
- "dark story ABOUT feelings" -> narrative games (NOT shooters)
- "experimental art game" -> weird/experimental games (NOT mainstream)
- "cozy farming" -> Stardew Valley, Spiritfarer (NOT action games)
- "atmospheric horror" -> SOMA, Amnesia (NOT jump-scare games)

Game to match:
Title: ${game.title}
Description: ${game.description}

Read the description carefully. Identify:
1. What is the CORE EXPERIENCE? (action/combat, narrative/story, vibes/aesthetic, experimental/art)
2. What is the EMOTIONAL TONE? (whimsical, dark, cozy, intense, etc.)

Find 10 indie games that match BOTH the core experience AND the emotional tone.

Return a JSON array of exactly 10 games:
[
  {
    "title": "Game Title",
    "reason": "Why this matches the core experience AND tone"
  }
]

Only return valid JSON, no other text.`;

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

    // Validate suggestions against Steam
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
      testName: "Test D (Examples)",
      gameTitle: game.title,
      suggestions: validatedSuggestions.slice(0, 10),
      timing,
    });
  }

  return results;
}

if (require.main === module) {
  runExamplesInPromptTest()
    .then((results) => {
      console.log("Test D (Examples) Results:");
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
