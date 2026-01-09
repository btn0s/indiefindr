import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

const TEST_QUERIES = [
  { game: "Mouthwashing", query: "indie games similar to Mouthwashing psychological horror" },
  { game: "Go Ape Ship", query: "indie games similar to Go Ape Ship chaotic co-op multiplayer" },
  { game: "Hades", query: "indie games similar to Hades roguelike action" },
];

async function testPerplexity(game: string, query: string, requireUrls: boolean) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`GAME: ${game} ${requireUrls ? "(WITH URLS)" : "(NO URLS)"}`);
  console.log(`${"─".repeat(60)}`);

  const start = Date.now();
  
  const promptWithUrls = `Find 5 indie games similar to "${game}". For each game:
1. Provide the Steam store URL
2. Explain why it's similar in one sentence

Focus on games that match the actual gameplay feel, not just surface-level themes.

Output format:
1. Game Name - https://store.steampowered.com/app/XXXXX - Why it's similar
2. Game Name - https://store.steampowered.com/app/XXXXX - Why it's similar
...`;

  const promptNoUrls = `Find 5 indie games similar to "${game}". For each game, explain why it's similar in one sentence. Focus on games that match the actual gameplay feel, not just surface-level themes.

Output format:
1. Game Name - Why it's similar
2. Game Name - Why it's similar
...`;

  try {
    const { text } = await generateText({
      model: "perplexity/sonar",
      prompt: requireUrls ? promptWithUrls : promptNoUrls,
    });

    const elapsed = Date.now() - start;
    console.log(`\nTime: ${elapsed}ms`);
    console.log(`\nResults:\n${text.slice(0, 800)}`);
    
    return { game, elapsed, success: true };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`\nTime: ${elapsed}ms`);
    console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
    return { game, elapsed, success: false };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("WEB SEARCH TIMING TEST - PERPLEXITY");
  console.log("=".repeat(60));

  const results = [];
  
  console.log("\n>>> WITHOUT STEAM URLS <<<\n");
  for (const { game, query } of TEST_QUERIES) {
    const result = await testPerplexity(game, query, false);
    results.push(result);
  }

  console.log("\n>>> WITH STEAM URLS <<<\n");
  for (const { game, query } of TEST_QUERIES) {
    const result = await testPerplexity(game, query, true);
    results.push(result);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  for (const r of results) {
    const status = r.success ? "✓" : "✗";
    console.log(`${status} ${r.game}: ${r.elapsed}ms`);
  }
  
  const avg = results.reduce((s, r) => s + r.elapsed, 0) / results.length;
  console.log(`\nAverage: ${Math.round(avg)}ms`);
}

main().catch(console.error);
