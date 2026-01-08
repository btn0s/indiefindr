import { createClient } from "@supabase/supabase-js";
import { fetchSteamSpyGame, fetchGamesByTag, getTopTags } from "./steamspy-client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE env vars");
}

const supabase = createClient(supabaseUrl, supabaseKey);

type EnrichmentResult = {
  appid: number;
  steamspy_tags: Record<string, number>;
  steamspy_owners: string;
  steamspy_positive: number;
  steamspy_negative: number;
  steamspy_updated_at: string;
};

async function getGamesToEnrich(limit = 50): Promise<number[]> {
  const { data, error } = await supabase
    .from("games_new")
    .select("appid, steamspy_updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42703") {
      console.log("NOTICE: steamspy_* columns don't exist yet. Run migration first:");
      console.log("  supabase/migrations/20260108000002_add_steamspy_enrichment.sql");
      console.log("\nFalling back to selecting all recent games...\n");
      
      const { data: fallback } = await supabase
        .from("games_new")
        .select("appid")
        .order("created_at", { ascending: false })
        .limit(limit);
      return fallback?.map((g) => g.appid) ?? [];
    }
    console.error("Failed to fetch games:", error);
    return [];
  }

  return data
    ?.filter((g) => !g.steamspy_updated_at)
    .map((g) => g.appid) ?? [];
}

async function saveEnrichment(result: EnrichmentResult): Promise<boolean> {
  const { error } = await supabase
    .from("games_new")
    .update({
      steamspy_tags: result.steamspy_tags,
      steamspy_owners: result.steamspy_owners,
      steamspy_positive: result.steamspy_positive,
      steamspy_negative: result.steamspy_negative,
      steamspy_updated_at: result.steamspy_updated_at,
    })
    .eq("appid", result.appid);

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return false;
    }
    console.error(`Failed to save enrichment for ${result.appid}:`, error);
    return false;
  }
  return true;
}

async function enrichGame(appid: number): Promise<EnrichmentResult | null> {
  const data = await fetchSteamSpyGame(appid);
  if (!data) return null;

  return {
    appid,
    steamspy_tags: data.tags,
    steamspy_owners: data.owners,
    steamspy_positive: data.positive,
    steamspy_negative: data.negative,
    steamspy_updated_at: new Date().toISOString(),
  };
}

async function runEnrichmentWorker(batchSize = 50): Promise<void> {
  console.log("=== STEAMSPY ENRICHMENT WORKER (DB) ===\n");

  const appids = await getGamesToEnrich(batchSize);
  console.log(`Found ${appids.length} games to enrich\n`);

  if (appids.length === 0) {
    console.log("No games need enrichment. Done.");
    return;
  }

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let migrationMissing = false;

  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    console.log(`[${i + 1}/${appids.length}] Enriching ${appid}...`);

    const result = await enrichGame(appid);
    if (!result) {
      console.log(`  SKIP: No SteamSpy data`);
      failCount++;
      continue;
    }

    const topTags = getTopTags(result.steamspy_tags, 5);
    const saved = await saveEnrichment(result);

    if (saved) {
      console.log(`  OK: ${result.steamspy_owners} owners, tags: [${topTags.join(", ")}]`);
      successCount++;
    } else {
      migrationMissing = true;
      console.log(`  FETCHED: ${result.steamspy_owners} owners, tags: [${topTags.join(", ")}]`);
      console.log(`           (not saved - migration needed)`);
      failCount++;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n=== COMPLETE ===`);
  console.log(`Success: ${successCount}, Failed: ${failCount}`);
  console.log(`Time: ${elapsed.toFixed(1)}s (${(appids.length / elapsed).toFixed(2)} games/sec)`);
  
  if (migrationMissing) {
    console.log(`\n!!! TO SAVE DATA, APPLY MIGRATION: !!!`);
    console.log(`    supabase/migrations/20260108000002_add_steamspy_enrichment.sql`);
  }
}

const batchSize = parseInt(process.argv[2] || "50", 10);
runEnrichmentWorker(batchSize).catch(console.error);
