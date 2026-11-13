import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Shared by metadata and page rendering; one lookup per render. */
export const getGame = cache(async (appid: number) => {
  const { data, error } = await getSupabaseServerClient()
    .from("games")
    .select("appid,title,short_description,header_image,developers,publishers,release_date,genres,review_count,review_positive_pct,price_cents,is_free,screenshots,trailers")
    .eq("appid", appid)
    .maybeSingle();
  if (error) throw new Error("Catalog unavailable");
  return data;
});

export type RecommendationCard = {
  rank: number;
  source: "llm" | "model";
  game: { appid: number; title: string; header_image: string | null; is_indie: boolean };
};

/** Join cards in the same database read as the saved slate. */
export async function getRecommendations(appid: number): Promise<RecommendationCard[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select("rank,source,game:games!game_recs_rec_appid_fkey!inner(appid,title,header_image,is_indie)")
    .eq("appid", appid)
    .eq("game.is_indie", true)
    .order("rank");
  if (error) throw new Error("Recommendations unavailable");
  const recs = (data ?? []) as unknown as RecommendationCard[];
  const source = recs.some((rec) => rec.source === "llm") ? "llm" : "model";
  return recs.filter((rec) => rec.source === source);
}

type ShelfGame = { appid: number; title: string; header_image: string | null };
const SHELF_FIELDS = "appid,title,header_image";
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Same order for everyone on a given day, different the next day. */
function dailyPick<T>(items: T[], count: number): T[] {
  let seed = Math.floor(Date.now() / 86_400_000);
  const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

/** Home discovery shelves: recent risers, well-loved lesser-known games, and brand-new releases. */
export async function getHomeShelves() {
  const db = getSupabaseServerClient();
  const indie = () => db.from("games").select(SHELF_FIELDS).eq("is_indie", true);
  const [rising, gems, fresh] = await Promise.all([
    indie().gte("release_date", daysAgo(365)).gte("review_count", 200).gte("review_positive_pct", 80)
      .order("review_count", { ascending: false }).limit(8),
    indie().gte("review_positive_pct", 92).gte("review_count", 300).lte("review_count", 5000)
      .order("review_positive_pct", { ascending: false }).order("review_count", { ascending: false }).limit(240),
    indie().gte("release_date", daysAgo(60)).order("release_date", { ascending: false }).order("review_count", { ascending: false }).limit(8),
  ]);
  if (rising.error || gems.error || fresh.error) throw new Error("Catalog unavailable");
  return {
    rising: rising.data as ShelfGame[],
    gems: dailyPick(gems.data as ShelfGame[], 8),
    fresh: fresh.data as ShelfGame[],
  };
}
