import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugEmbeddings() {
  console.log("=== Checking game_embeddings table ===\n");

  const { data: embeddings, error } = await supabase
    .from("game_embeddings")
    .select("appid, facet, embedding_model, source_type, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching embeddings:", error);
    return;
  }

  console.log(`Total embeddings: ${embeddings?.length || 0}\n`);

  if (embeddings && embeddings.length > 0) {
    const byGame = embeddings.reduce((acc, e) => {
      if (!acc[e.appid]) acc[e.appid] = [];
      acc[e.appid].push(e.facet);
      return acc;
    }, {} as Record<number, string[]>);

    console.log("Embeddings by game:");
    for (const [appid, facets] of Object.entries(byGame)) {
      console.log(`  ${appid}: ${facets.join(", ")}`);
    }
  } else {
    console.log("No embeddings found in database!");
    console.log("\nEmbeddings are generated in background during ingest.");
    console.log("Check server logs for errors during embedding generation.");
  }

  console.log("\n=== Checking games_new table ===\n");

  const { data: games, error: gamesError } = await supabase
    .from("games_new")
    .select("appid, title")
    .in("appid", [397540, 49520]);

  if (gamesError) {
    console.error("Error fetching games:", gamesError);
    return;
  }

  console.log("Games in database:");
  games?.forEach((g) => console.log(`  ${g.appid}: ${g.title}`));

  console.log("\n=== Testing similarity RPC ===\n");

  const { data: similar, error: rpcError } = await supabase.rpc(
    "find_similar_games",
    {
      p_appid: 397540,
      p_facet: "aesthetic",
      p_limit: 10,
      p_threshold: 0.0,
    }
  );

  if (rpcError) {
    console.error("RPC error:", rpcError);
  } else {
    console.log("Similar games for 397540 (aesthetic):", similar);
  }
}

debugEmbeddings().catch(console.error);
