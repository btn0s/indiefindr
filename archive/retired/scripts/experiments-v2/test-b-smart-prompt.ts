#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";
import { getSupabaseServerClient } from "../../src/lib/supabase/server";
import { TEST_GAMES, TestGame } from "./shared/test-games";
import { TestResult } from "./shared/output";
import { validateSuggestion, buildGameMap } from "./shared/validate-steam";

export async function runSmartPromptTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabaseServerClient();
  const gameMap = await buildGameMap(supabase);

  for (const game of TEST_GAMES) {
    const startTime = Date.now();

    const prompt = `Read this game carefully:
Title: ${game.title}
Description: ${game.description}

STEP 1: Identify the CORE EXPERIENCE
- Is this primarily ACTION/COMBAT? (look for: guns, fighting, shooting, tactical)
- Is this primarily NARRATIVE/EMOTIONAL? (look for: story, choices, feelings)
- Is this primarily VIBES/ATMOSPHERE? (look for: exploration, relaxation, aesthetic)

STEP 2: Find 10 indie games that match BOTH:
- The emotional TONE of the description
- The CORE EXPERIENCE identified above

CRITICAL EXAMPLES:
- A dark story WITH guns = find other shooters with dark tone (NOT narrative games)
- A dark story ABOUT feelings = find other narrative games (NOT shooters)
- "gigantic crustacean with cannons" = whimsical, quirky, charming (NOT shooters)
- "guns-blazing, tactical" = action FPS games (NOT narrative games)

Return a JSON array of exactly 10 games:
[
  {
    "title": "Game Title",
    "reason": "Why this matches the tone AND core experience"
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
      testName: "Test B (Smart Prompt)",
      gameTitle: game.title,
      suggestions: validatedSuggestions.slice(0, 10),
      timing,
    });
  }

  return results;
}

if (require.main === module) {
  runSmartPromptTest()
    .then((results) => {
      console.log("Test B (Smart Prompt) Results:");
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
