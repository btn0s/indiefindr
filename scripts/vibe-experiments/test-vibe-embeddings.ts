import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEST_GAMES = [
  { appid: 4037180, name: "Go Ape Ship", expectedMatches: ["Overcooked", "PlateUp", "Headsnatchers"] },
  { appid: 2475490, name: "Mouthwashing", expectedMatches: ["Iron Lung", "Signalis", "Observation"] },
  { appid: 3098700, name: "Toilet Spiders", expectedMatches: ["Iron Lung", "Puppet Combo"] },
];

async function testGame(appid: number, name: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`TEST: ${name} (${appid})`);
  console.log(`${"─".repeat(60)}`);

  const { data: sourceVibe } = await supabase
    .from("game_vibes")
    .select("vibe_summary")
    .eq("appid", appid)
    .single();

  if (!sourceVibe) {
    console.log("  ⚠ No vibe summary found for this game yet");
    return;
  }

  console.log(`\nVibe Summary:\n${sourceVibe.vibe_summary}\n`);

  const { data: matches, error } = await supabase
    .rpc("find_similar_vibes", {
      source_appid: appid,
      match_count: 10,
      similarity_threshold: 0.4,
    });

  if (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return;
  }

  if (!matches || matches.length === 0) {
    console.log("  No matches found above threshold");
    return;
  }

  console.log("Top Matches:");
  for (const match of matches) {
    const pct = Math.round(match.similarity * 100);
    console.log(`  [${pct}%] ${match.title}`);
    const summaryPreview = match.vibe_summary.split("\n").slice(0, 3).join(" | ");
    console.log(`         ${summaryPreview.slice(0, 80)}...`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("VIBE EMBEDDING SIMILARITY TEST");
  console.log("=".repeat(60));

  const { count } = await supabase
    .from("game_vibes")
    .select("*", { count: "exact", head: true });

  console.log(`\nTotal games with vibe embeddings: ${count || 0}`);

  for (const game of TEST_GAMES) {
    await testGame(game.appid, game.name);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("DONE");
}

main().catch(console.error);
