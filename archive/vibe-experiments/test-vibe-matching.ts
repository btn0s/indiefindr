import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GameData = {
  appid: number;
  title: string;
  short_description: string | null;
  long_description: string | null;
  steamspy_tags: Record<string, number> | null;
};

async function fetchGame(appid: number): Promise<GameData | null> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title, short_description, long_description, steamspy_tags")
    .eq("appid", appid)
    .single();
  return data;
}

async function generateVibeSummary(game: GameData): Promise<string> {
  const prompt = `Analyze this game and output a concise "vibe summary" (2-3 sentences) that captures what makes it unique. Focus on: tone, humor style, core fantasy, and what type of player would love it.

Title: ${game.title}
Description: ${game.short_description || game.long_description || "No description"}
Tags: ${game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 10).join(", ") : "None"}

Output ONLY the vibe summary, nothing else.`;

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4-20250514",
    prompt,
  });

  return text;
}

async function findSimilarGames(
  sourceVibe: string,
  sourceAppid: number,
  candidateCount = 30
): Promise<Array<{ appid: number; title: string; score: number; reason: string }>> {
  const { data: candidates } = await supabase
    .from("games_new")
    .select("appid, title, short_description, steamspy_tags")
    .neq("appid", sourceAppid)
    .not("short_description", "is", null)
    .limit(candidateCount);

  if (!candidates?.length) return [];

  const candidateDescriptions = candidates
    .map((c, i) => `${i + 1}. ${c.title}: ${c.short_description?.slice(0, 200)}`)
    .join("\n");

  const prompt = `Given this game's vibe:
"${sourceVibe}"

Rate these games 1-10 on how well they match the vibe (not just genre, but TONE and FEELING):

${candidateDescriptions}

Output JSON array: [{"index": 1, "score": 8, "reason": "brief reason"}, ...]
Only include games with score >= 6. Output ONLY valid JSON.`;

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4-20250514",
    prompt,
  });

  try {
    const matches = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
    return matches
      .filter((m: any) => m.score >= 6)
      .map((m: any) => ({
        appid: candidates[m.index - 1]?.appid,
        title: candidates[m.index - 1]?.title,
        score: m.score,
        reason: m.reason,
      }))
      .filter((m: any) => m.appid);
  } catch {
    console.error("Failed to parse matches:", text);
    return [];
  }
}

async function main() {
  const testAppId = parseInt(process.argv[2] || "4037180");

  console.log(`\n=== VIBE MATCHING TEST ===\n`);
  console.log(`Testing with appid: ${testAppId}\n`);

  const game = await fetchGame(testAppId);
  if (!game) {
    console.error("Game not found");
    return;
  }

  console.log(`Game: ${game.title}`);
  console.log(`Description: ${game.short_description?.slice(0, 200)}...`);
  console.log(`Tags: ${game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"}`);

  console.log(`\n--- Generating Vibe Summary ---\n`);
  const vibe = await generateVibeSummary(game);
  console.log(`Vibe: ${vibe}`);

  console.log(`\n--- Finding Similar Games ---\n`);
  const matches = await findSimilarGames(vibe, testAppId, 30);

  if (matches.length === 0) {
    console.log("No strong matches found");
  } else {
    console.log(`Found ${matches.length} matches:\n`);
    for (const m of matches.sort((a, b) => b.score - a.score)) {
      console.log(`[${m.score}/10] ${m.title}`);
      console.log(`         ${m.reason}\n`);
    }
  }
}

main().catch(console.error);
