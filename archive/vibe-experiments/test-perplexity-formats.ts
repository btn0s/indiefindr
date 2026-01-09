import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

const TEST_GAME = "Mouthwashing";

async function testFormat(name: string, prompt: string) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`FORMAT: ${name}`);
  console.log(`${"─".repeat(70)}`);

  const start = Date.now();
  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt,
    });
    const elapsed = Date.now() - start;
    console.log(`Time: ${elapsed}ms\n`);
    console.log(text);
    return { name, elapsed, text, success: true };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`Time: ${elapsed}ms`);
    console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
    return { name, elapsed, text: null, success: false };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("PERPLEXITY FORMAT TESTS");
  console.log("=".repeat(70));

  const jsonPrompt5 = `Find 5 indie games similar to "${TEST_GAME}". Return ONLY valid JSON array, no other text.

Format:
[
  {"title": "Game Name", "reason": "One sentence why similar"},
  ...
]`;

  const jsonPrompt10 = `Find 10 indie games similar to "${TEST_GAME}". Return ONLY valid JSON array, no other text.

Format:
[
  {"title": "Game Name", "reason": "One sentence why similar"},
  ...
]`;

  const jsonPrompt10Strict = `Find exactly 10 indie games similar to "${TEST_GAME}".

CRITICAL: Return ONLY a valid JSON array. No markdown, no explanations, no text before or after.

Required format (exactly 10 items):
[{"title":"Game Name","reason":"Why similar"}]`;

  const cleanExplanationPrompt = `Find 10 indie games similar to "${TEST_GAME}".

For each game, write a SHORT (under 15 words) user-friendly explanation of why it's similar. Write as if recommending to a friend, not a review.

BAD: "Shares the same psychological horror elements with environmental storytelling mechanics"
GOOD: "Same creepy lo-fi horror vibe with a disturbing story"

Return ONLY valid JSON:
[{"title":"Game Name","reason":"Short friendly reason"}]`;

  await testFormat("JSON 5 games", jsonPrompt5);
  await testFormat("JSON 10 games", jsonPrompt10);
  await testFormat("JSON 10 strict", jsonPrompt10Strict);
  await testFormat("JSON 10 clean explanations", cleanExplanationPrompt);

  console.log(`\n${"=".repeat(70)}`);
  console.log("PARSING TEST");
  console.log("=".repeat(70));

  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: cleanExplanationPrompt,
  });

  console.log("\nRaw response:");
  console.log(text);

  console.log("\nParsing attempt:");
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`Parsed ${parsed.length} items`);
      for (const item of parsed) {
        console.log(`  - ${item.title}: "${item.reason}"`);
      }
    } else {
      console.log("No JSON array found");
    }
  } catch (err) {
    console.log(`Parse error: ${err instanceof Error ? err.message : err}`);
  }
}

main().catch(console.error);
