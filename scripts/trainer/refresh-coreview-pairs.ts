#!/usr/bin/env npx tsx

/**
 * Rebuild coreview_pairs from steam_review_edges (PMI-weighted), then print
 * the strongest pairs as a sanity check.
 *
 * Usage:
 *   npx tsx scripts/trainer/refresh-coreview-pairs.ts [--min-coreviews 3]
 */

import { config } from "dotenv";
config({ path: [".env.local"] });

import { getSupabaseServiceClient } from "../../src/lib/supabase/service";

const args = process.argv.slice(2);
const minIndex = args.indexOf("--min-coreviews");
const MIN_COREVIEWS =
  minIndex !== -1 && args[minIndex + 1] ? parseInt(args[minIndex + 1], 10) : 3;

async function main() {
  const supabase = getSupabaseServiceClient();

  console.log(`Refreshing coreview_pairs (min co-reviews: ${MIN_COREVIEWS})...`);
  const { data: inserted, error } = await supabase.rpc("refresh_coreview_pairs", {
    min_coreviews: MIN_COREVIEWS,
  });

  if (error) {
    console.error("refresh_coreview_pairs failed:", error.message);
    process.exit(1);
  }
  console.log(`Inserted ${inserted} pairs.\n`);

  const { data: top } = await supabase
    .from("coreview_pairs")
    .select("appid_a, appid_b, coreview_count, pmi")
    .order("pmi", { ascending: false })
    .limit(20);

  if (!top || top.length === 0) {
    console.log("No pairs yet — crawl more games with mine-steam-coreviews.ts");
    return;
  }

  const appids = Array.from(
    new Set(top.flatMap((p: { appid_a: number; appid_b: number }) => [p.appid_a, p.appid_b]))
  );
  const { data: games } = await supabase
    .from("games_new")
    .select("appid, title")
    .in("appid", appids);
  const titles = new Map(
    (games ?? []).map((g: { appid: number; title: string }) => [g.appid, g.title])
  );

  console.log("Top pairs by PMI:");
  for (const pair of top) {
    const a = titles.get(pair.appid_a) ?? pair.appid_a;
    const b = titles.get(pair.appid_b) ?? pair.appid_b;
    console.log(
      `  ${a} <-> ${b}  (co-reviews: ${pair.coreview_count}, pmi: ${pair.pmi.toFixed(2)})`
    );
  }
}

void main();
