import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

const TEST_GAMES = [
  { name: "PIGFACE", desc: "You wake up with an explosive headache in a pool of your own blood. You're Exit, a terrible woman." },
  { name: "Mouthwashing", desc: "Five crew members stranded in space, shrouded in perpetual night." },
  { name: "Go Ape Ship", desc: "Frantic co-op multiplayer for 1-8 players. Work with your crew of Astrochimps." },
];

const PROMPTS = {
  basic: (game: string, count: number) => 
    `Find ${count} indie games similar to "${game}". Return JSON: [{"title":"Game","reason":"Why similar"}]`,

  friendly: (game: string, count: number) =>
    `Find ${count} indie games similar to "${game}".
Write SHORT (under 15 words) friendly reasons, like recommending to a friend.
Return ONLY JSON: [{"title":"Game","reason":"Why similar"}]`,

  gameplay_focused: (game: string, count: number) =>
    `Find ${count} indie games similar to "${game}".
Focus on games that match the actual GAMEPLAY FEEL, not just themes or setting.
Write SHORT friendly reasons (under 15 words).
Return ONLY JSON: [{"title":"Game","reason":"Why similar"}]`,

  vibe_match: (game: string, desc: string, count: number) =>
    `Find ${count} indie games similar to "${game}" (${desc}).
Match on VIBE: perspective, tone, pacing, aesthetic, core loop.
Prioritize lesser-known indie games over mainstream titles.
Write SHORT friendly reasons (under 15 words).
Return ONLY JSON: [{"title":"Game","reason":"Why similar"}]`,
};

type PromptKey = keyof typeof PROMPTS;

async function testPrompt(promptKey: PromptKey, game: { name: string; desc: string }, count: number) {
  const prompt = promptKey === "vibe_match" 
    ? PROMPTS[promptKey](game.name, game.desc, count)
    : (PROMPTS[promptKey] as (g: string, c: number) => string)(game.name, count);

  const start = Date.now();
  const { text } = await generateText({ model: "perplexity/sonar", prompt });
  const elapsed = Date.now() - start;

  let parsed: any[] = [];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {}

  return { elapsed, count: parsed.length, titles: parsed.map(p => p.title) };
}

async function main() {
  console.log("=".repeat(70));
  console.log("PERPLEXITY PROMPT & SCALE TESTING");
  console.log("=".repeat(70));

  console.log("\n>>> PART 1: PROMPT COMPARISON (5 results each) <<<\n");

  for (const game of TEST_GAMES.slice(0, 1)) {
    console.log(`\nGame: ${game.name}`);
    console.log("-".repeat(50));

    for (const [key, _] of Object.entries(PROMPTS)) {
      const result = await testPrompt(key as PromptKey, game, 5);
      console.log(`${key.padEnd(20)} | ${result.elapsed}ms | ${result.count} results`);
      console.log(`  → ${result.titles.slice(0, 3).join(", ")}...`);
    }
  }

  console.log("\n>>> PART 2: SCALE TESTING (vibe_match prompt) <<<\n");

  const counts = [5, 8, 10, 15];
  const game = TEST_GAMES[1];

  console.log(`Game: ${game.name}`);
  console.log("-".repeat(50));

  const scaleResults: { count: number; elapsed: number; actual: number }[] = [];

  for (const count of counts) {
    const result = await testPrompt("vibe_match", game, count);
    scaleResults.push({ count, elapsed: result.elapsed, actual: result.count });
    console.log(`Request ${count.toString().padStart(2)} | Got ${result.count.toString().padStart(2)} | ${result.elapsed}ms`);
  }

  console.log("\n>>> PART 3: BURST TEST (3 parallel requests) <<<\n");

  const burstStart = Date.now();
  const burstResults = await Promise.all(
    TEST_GAMES.map(g => testPrompt("vibe_match", g, 8))
  );
  const burstTotal = Date.now() - burstStart;

  for (let i = 0; i < TEST_GAMES.length; i++) {
    console.log(`${TEST_GAMES[i].name.padEnd(15)} | ${burstResults[i].elapsed}ms | ${burstResults[i].count} results`);
  }
  console.log(`\nParallel total: ${burstTotal}ms (vs ${burstResults.reduce((s, r) => s + r.elapsed, 0)}ms sequential)`);

  console.log("\n>>> SUMMARY <<<\n");

  const avgPerResult = scaleResults.map(r => r.elapsed / r.actual);
  console.log("Time per result (vibe_match):");
  for (let i = 0; i < scaleResults.length; i++) {
    console.log(`  ${scaleResults[i].count} requested: ${Math.round(avgPerResult[i])}ms/result`);
  }
}

main().catch(console.error);
