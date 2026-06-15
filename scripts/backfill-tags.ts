#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: [".env.local"] });

import { getSupabaseServiceClient } from "../src/lib/supabase/service";
import { fetchSteamSpyData } from "../src/lib/utils/steamspy";

async function main() {
  const supabase = getSupabaseServiceClient();
  const { data: games } = await supabase
    .from("games_new")
    .select("appid, title, steamspy_tags");
  if (!games) {
    console.log("no games");
    return;
  }

  const needsTags = games.filter(
    (g) => !g.steamspy_tags || Object.keys(g.steamspy_tags).length === 0
  );
  console.log(`Games needing tags: ${needsTags.length} / ${games.length}`);

  for (const game of needsTags) {
    const data = await fetchSteamSpyData(game.appid);
    if (data && Object.keys(data.tags).length > 0) {
      const { error } = await supabase
        .from("games_new")
        .update({
          steamspy_tags: data.tags,
          steamspy_positive: data.positive,
          steamspy_negative: data.negative,
          steamspy_owners: data.owners,
        })
        .eq("appid", game.appid);
      if (error) console.error("  FAIL:", game.appid, error.message);
      else
        console.log(
          "  OK:",
          game.appid,
          game.title,
          Object.keys(data.tags).length,
          "tags"
        );
    } else {
      console.log("  SKIP:", game.appid, game.title, "- no SteamSpy data");
    }
  }
  console.log("Done");
}

main().catch(console.error);
