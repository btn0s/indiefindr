import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3-5-haiku-20241022",
  "google/gemini-2.0-flash",
];

type GameData = {
  appid: number;
  title: string;
  short_description: string | null;
  steamspy_tags: Record<string, number> | null;
};

async function fetchGame(appid: number): Promise<GameData | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, short_description, steamspy_tags")
    .eq("appid", appid)
    .single();
  return data;
}

async function generateVibe(model: string, game: GameData): Promise<{ vibe: string; ms: number }> {
  const prompt = `Analyze this game and output a concise "vibe summary" (2-3 sentences) that captures what makes it unique. Focus on: tone, humor style, core fantasy, and what type of player would love it.

Title: ${game.title}
Description: ${game.short_description || "No description"}
Tags: ${game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 10).join(", ") : "None"}

Output ONLY the vibe summary, nothing else.`;

  const start = Date.now();
  const { text } = await generateText({ model, prompt });
  return { vibe: text, ms: Date.now() - start };
}

async function main() {
  const testAppId = parseInt(process.argv[2] || "4037180");
  
  const game = await fetchGame(testAppId);
  if (!game) {
    console.error("Game not found");
    return;
  }

  console.log(`\n=== MODEL COMPARISON: ${game.title} ===\n`);
  console.log(`Description: ${game.short_description?.slice(0, 150)}...\n`);

  for (const model of MODELS) {
    console.log(`--- ${model} ---`);
    try {
      const { vibe, ms } = await generateVibe(model, game);
      console.log(`Time: ${ms}ms`);
      console.log(`Vibe: ${vibe}\n`);
    } catch (err) {
      console.log(`Error: ${err instanceof Error ? err.message : err}\n`);
    }
  }
}

main().catch(console.error);
