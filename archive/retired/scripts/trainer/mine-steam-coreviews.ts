#!/usr/bin/env npx tsx

/**
 * Source A: mine Steam co-review edges for the catalog.
 *
 * For each game in games_new, fetches public review pages from Steam's
 * appreviews endpoint and stores (appid, hashed reviewer id) edges.
 * Co-occurrence of the same reviewer across two catalog games is the
 * "players also liked" signal; refresh-coreview-pairs.ts turns edges
 * into PMI-weighted pairs.
 *
 * Resumable: games that already have edges are skipped unless --refresh.
 *
 * Usage:
 *   npx tsx scripts/trainer/mine-steam-coreviews.ts [--limit 50] [--pages 3] [--delay-ms 1500] [--refresh]
 */

import { config } from "dotenv";
config({ path: [".env.local"] });

import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "../../src/lib/supabase/service";

const args = process.argv.slice(2);

function argValue(name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return fallback;
  const parsed = parseInt(args[index + 1], 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const LIMIT = argValue("limit", 50);
const PAGES = argValue("pages", 3);
const DELAY_MS = argValue("delay-ms", 1500);
const REFRESH = args.includes("--refresh");

const REVIEWS_PER_PAGE = 100;

function hashReviewer(steamid: string): string {
  return createHash("sha256").update(steamid).digest("hex").slice(0, 16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ReviewsPage = {
  success?: number;
  cursor?: string;
  reviews?: Array<{ author?: { steamid?: string } }>;
};

async function fetchReviewerHashes(appid: number): Promise<string[]> {
  const hashes = new Set<string>();
  let cursor = "*";

  for (let page = 0; page < PAGES; page++) {
    const url =
      `https://store.steampowered.com/appreviews/${appid}` +
      `?json=1&filter=recent&language=all&purchase_type=all` +
      `&num_per_page=${REVIEWS_PER_PAGE}&cursor=${encodeURIComponent(cursor)}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  [${appid}] reviews fetch failed: ${response.status}`);
      break;
    }

    const data = (await response.json()) as ReviewsPage;
    const reviews = data.reviews ?? [];
    for (const review of reviews) {
      const steamid = review.author?.steamid;
      if (steamid) hashes.add(hashReviewer(steamid));
    }

    if (!data.cursor || data.cursor === cursor || reviews.length < REVIEWS_PER_PAGE) {
      break;
    }
    cursor = data.cursor;
    await sleep(DELAY_MS);
  }

  return Array.from(hashes);
}

async function main() {
  const supabase = getSupabaseServiceClient();

  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title")
    .order("appid", { ascending: true })
    .limit(10000);

  if (error || !games) {
    console.error("Failed to fetch catalog:", error?.message);
    process.exit(1);
  }

  let crawled = new Set<number>();
  if (!REFRESH) {
    const { data: existing } = await supabase
      .from("steam_review_edges")
      .select("appid")
      .limit(100000);
    crawled = new Set((existing ?? []).map((row: { appid: number }) => row.appid));
  }

  const todo = games.filter((g: { appid: number }) => !crawled.has(g.appid)).slice(0, LIMIT);
  console.log(
    `Catalog: ${games.length} games, ${crawled.size} already crawled, processing ${todo.length} this run`
  );

  let totalEdges = 0;
  for (let i = 0; i < todo.length; i++) {
    const game = todo[i] as { appid: number; title: string };
    console.log(`[${i + 1}/${todo.length}] ${game.title} (${game.appid})`);

    const hashes = await fetchReviewerHashes(game.appid);
    if (hashes.length > 0) {
      const rows = hashes.map((reviewer_hash) => ({
        appid: game.appid,
        reviewer_hash,
      }));
      const { error: insertError } = await supabase
        .from("steam_review_edges")
        .upsert(rows, { onConflict: "appid,reviewer_hash", ignoreDuplicates: true });
      if (insertError) {
        console.error(`  insert failed: ${insertError.message}`);
      } else {
        totalEdges += rows.length;
        console.log(`  +${rows.length} reviewer edges`);
      }
    } else {
      console.log("  no reviews found");
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${totalEdges} edges written this run.`);
  console.log(
    "Next: npx tsx scripts/trainer/refresh-coreview-pairs.ts (after enough of the catalog is crawled)"
  );
}

void main();
