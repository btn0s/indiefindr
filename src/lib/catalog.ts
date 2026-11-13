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
  game: CardGame & { is_indie: boolean };
};

/** The game's full list: hand-written (LLM) picks first where a game has them, then the model's, without repeats.
 *  Cards are joined in the same database read. */
export const getRecommendations = cache(async (appid: number): Promise<RecommendationCard[]> => {
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select("rank,source,game:games!game_recs_rec_appid_fkey!inner(appid,title,header_image,review_count,review_positive_pct,is_indie)")
    .eq("appid", appid)
    .eq("game.is_indie", true)
    .order("rank");
  if (error) throw new Error("Recommendations unavailable");
  const recs = (data ?? []) as unknown as RecommendationCard[];
  const seen = new Set<number>();
  return [...recs.filter(rec => rec.source === "llm"), ...recs.filter(rec => rec.source === "model")]
    .filter(rec => rec.game.appid !== appid && !seen.has(rec.game.appid) && seen.add(rec.game.appid));
});

/** Up to four more indies from the same developer(s), newest first. */
export const getDeveloperGames = cache(async (appid: number, developers: string[]): Promise<CardGame[]> => {
  if (!developers.length) return [];
  const { data } = await getSupabaseServerClient().from("games").select(CARD_FIELDS)
    .neq("appid", appid).eq("is_indie", true).or(developers.map(dev => `developers.cs.{${dev}}`).join(","))
    .order("release_date", { ascending: false }).limit(4);
  return data ?? [];
});

/** Everything a game card shows, selected the same way everywhere. */
export const CARD_FIELDS = "appid,title,header_image,review_count,review_positive_pct";
export type CardGame = { appid: number; title: string; header_image: string | null; review_count: number; review_positive_pct: number | null };
type ShelfGame = CardGame;
const SHELF_FIELDS = CARD_FIELDS;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Same order for everyone on a given day, different the next day. */
function dailyPick<T>(items: T[], count: number): T[] {
  let seed = Math.floor(Date.now() / 86_400_000);
  const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

const shelfBase = () => getSupabaseServerClient().from("games").select(SHELF_FIELDS).eq("is_indie", true);
type ShelfQuery = ReturnType<typeof shelfBase>;

/** Discovery shelves: one definition drives both the home preview and the shelf's own page. */
export const SHELVES = {
  rising: {
    title: "Rising", note: "Breakout indies from the past year",
    query: (q: ShelfQuery) => q.gte("release_date", daysAgo(365)).gte("review_count", 200).gte("review_positive_pct", 80)
      .order("review_count", { ascending: false }),
  },
  "hidden-gems": {
    title: "Hidden gems", note: "Loved by players, still under the radar",
    query: (q: ShelfQuery) => q.gte("review_positive_pct", 92).gte("review_count", 300).lte("review_count", 5000)
      .order("review_positive_pct", { ascending: false }).order("review_count", { ascending: false }),
  },
  new: {
    title: "New on Steam", note: "Released in the last two months",
    query: (q: ShelfQuery) => q.gte("release_date", daysAgo(60))
      .order("release_date", { ascending: false }).order("review_count", { ascending: false }),
  },
} as const;
export type ShelfSlug = keyof typeof SHELVES;
export const isShelf = (slug: string): slug is ShelfSlug => slug in SHELVES;

export async function getShelf(slug: ShelfSlug, limit: number): Promise<ShelfGame[]> {
  const { data, error } = await SHELVES[slug].query(shelfBase()).limit(limit);
  if (error) throw new Error("Catalog unavailable");
  return data;
}

/** Home previews; hidden gems rotate daily from the top of the shelf. */
export async function getHomeShelves() {
  const [rising, gems, fresh] = await Promise.all([getShelf("rising", 8), getShelf("hidden-gems", 240), getShelf("new", 4)]);
  return { rising, gems: dailyPick(gems, 8), fresh };
}

export const BROWSE_PAGE_SIZE = 24;

/** "Browse all": every indie game, most-reviewed first. */
export async function getBrowsePage(offset: number): Promise<CardGame[]> {
  const { data, error } = await getSupabaseServerClient().from("games").select(CARD_FIELDS).eq("is_indie", true)
    .order("review_count", { ascending: false }).order("appid").range(offset, offset + BROWSE_PAGE_SIZE - 1);
  if (error) throw new Error("Catalog unavailable");
  return data;
}
