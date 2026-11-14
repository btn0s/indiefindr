import { recommendationEligible, type ReviewQuality } from "@/lib/review-quality";
import { cacheLife } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { HERO_FIELDS } from "@/lib/hero";
import { POPULAR_INDIES } from "@/lib/popular-indies";
import type { PopularPick } from "@/lib/use-game-search";

/** Shared by metadata and page rendering. Catalog reads are cached server-side: games and their recommendations
 *  shelves and Browse all change hourly at most (home's showcase rotates by the minute). Anything shown on every page
 *  (the 404's Browse all is prerendered into each route) must not be shorter-lived than the pages themselves. */
export async function getGame(appid: number) {
  "use cache";
  cacheLife("hours");
  const { data, error } = await getSupabaseServerClient()
    .from("games")
    .select("appid,title,short_description,header_image,developers,publishers,release_date,genres,review_count,review_positive_pct,clean_score,bomb_windows,checked_at,price_cents,is_free,is_indie,screenshots,trailers,palette")
    .eq("appid", appid)
    .maybeSingle();
  if (error) throw new Error("Catalog unavailable");
  return data;
}

export type RecommendationCard = {
  rank: number;
  source: "llm" | "model";
  /** Up to three tags the two games share, most specific first; null when they share nothing specific. */
  why: string[] | null;
  game: CardGame & { is_indie: boolean };
};

/** The game's full list: hand-written (LLM) picks first where a game has them, then the model's, without repeats.
 *  Cards are joined in the same database read. */
export async function getRecommendations(appid: number): Promise<RecommendationCard[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select(`rank,source,why,game:games!game_recs_rec_appid_fkey!inner(${CARD_FIELDS},is_indie)`)
    .eq("appid", appid)
    .eq("game.is_indie", true)
    .eq("game.is_companion", false)
    .order("rank");
  if (error) throw new Error("Recommendations unavailable");
  const recs = (data ?? []) as unknown as RecommendationCard[];
  const seen = new Set<number>();
  return [...recs.filter(rec => rec.source === "llm"), ...recs.filter(rec => rec.source === "model")]
    .filter(rec => recommendationEligible(rec.game))
    .filter(rec => rec.game.appid !== appid && !seen.has(rec.game.appid) && seen.add(rec.game.appid));
}

/** Up to four more indies from the same developer(s), newest first. */
/** Array-filter elements for postgrest-js, which joins them unquoted: quoting keeps names like "Studio, Inc." intact. */
export const textArray = (values: string[]) => values.map(value => `"${value.replace(/["\\]/g, "\\$&")}"`);

export async function getDeveloperGames(appid: number, developers: string[]): Promise<CardGame[]> {
  "use cache";
  cacheLife("hours");
  if (!developers.length) return [];
  const { data } = await getSupabaseServerClient().from("games").select(CARD_FIELDS)
    .neq("appid", appid).eq("is_indie", true).eq("is_companion", false).overlaps("developers", textArray(developers))
    .order("release_date", { ascending: false }).limit(4);
  return (data ?? []).filter(recommendationEligible);
}

/** Everything a game card shows, selected the same way everywhere. */
export const CARD_FIELDS = `appid,title,header_image,review_count,review_positive_pct,clean_score,bomb_windows,checked_at,${HERO_FIELDS}`;
export type CardGame = ReviewQuality & {
  appid: number; title: string; header_image: string | null; review_count: number; review_positive_pct: number | null;
  hero_poster: string | null; hero_still: string | null;
};
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

/** Discovery shelves boost indies that still need it: indie+ games (lifetime reviews past the pipeline's
 *  notoriety line) stay searchable and recommendable but never appear here, nor do Steam adult-only titles or
 *  companion apps (demos, prologues, DLC, soundtracks; scripts/relaunch/catalog.py). */
const shelfBase = () => getSupabaseServerClient().from("games").select(SHELF_FIELDS)
  .eq("is_indie", true).eq("indie_plus", false).eq("is_adult", false).eq("is_companion", false);
type ShelfQuery = ReturnType<typeof shelfBase>;

/** Discovery shelves: one definition drives both the home preview and the shelf's own page. */
export const SHELVES = {
  rising: {
    // momentum is set nightly for indies launched (or released from early access) within a year, and for indies still in early
    // access at any age, with 30+ reviews in the last 14 days at 80%+ positive, moving at 1.5x+ their own earlier pace; ranked by
    // that ratio (scripts/relaunch/review_quality.py). Rising takes the released games, Early Access the rest.
    title: "Rising", note: "Indies picking up players right now",
    query: (q: ShelfQuery) => q.not("momentum", "is", null).eq("is_early_access", false).order("momentum", { ascending: false }).order("appid"),
  },
  "early-access": {
    title: "Early Access", note: "In-development indies players are flocking to",
    query: (q: ShelfQuery) => q.not("momentum", "is", null).eq("is_early_access", true).order("momentum", { ascending: false }).order("appid"),
  },
  upcoming: {
    // upcoming_rank is Steam's wishlist order among indies dated within six months, refreshed nightly (scripts/relaunch/upcoming.py).
    title: "Upcoming", note: "The most-wishlisted indies coming soon",
    query: (q: ShelfQuery) => q.not("upcoming_rank", "is", null).order("upcoming_rank"),
  },
  "hidden-gems": {
    title: "Hidden gems", note: "Loved by players, still under the radar",
    query: (q: ShelfQuery) => q.gte("review_positive_pct", 92).gte("review_count", 300).lte("review_count", 5000)
      .order("review_positive_pct", { ascending: false }).order("review_count", { ascending: false }),
  },
  new: {
    title: "New on Steam", note: "Released in the last two months",
    // Same quality bar as Rising: 30+ reviews so the score means something, 80%+ positive.
    query: (q: ShelfQuery) => q.gte("release_date", daysAgo(60)).lte("release_date", daysAgo(0)).gte("review_count", 30).gte("review_positive_pct", 80)
      .order("release_date", { ascending: false }).order("review_count", { ascending: false }),
  },
} as const;
export type ShelfSlug = keyof typeof SHELVES;
export const isShelf = (slug: string): slug is ShelfSlug => slug in SHELVES;

export async function getShelf(slug: ShelfSlug, limit: number): Promise<ShelfGame[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await SHELVES[slug].query(shelfBase()).limit(limit);
  if (error) throw new Error("Catalog unavailable");
  return data.filter(recommendationEligible);
}

/** Home previews in claim order: a game appears on one shelf at most, the first that claims it. Hidden gems is a daily pick. */
const HOME_SHELVES: { slug: ShelfSlug; fetch: number; show: number }[] = [
  { slug: "rising", fetch: 8, show: 8 },
  { slug: "early-access", fetch: 12, show: 4 },
  { slug: "new", fetch: 12, show: 4 },
  { slug: "upcoming", fetch: 8, show: 4 },
  { slug: "hidden-gems", fetch: 240, show: 8 },
];

export async function getHomeShelves() {
  "use cache";
  cacheLife("hours");
  const fetched = await Promise.all(HOME_SHELVES.map(({ slug, fetch }) => getShelf(slug, fetch)));
  const shown = new Set<number>();
  const shelves = {} as Record<ShelfSlug, ShelfGame[]>;
  HOME_SHELVES.forEach(({ slug, show }, index) => {
    const unclaimed = fetched[index].filter(game => !shown.has(game.appid));
    shelves[slug] = slug === "hidden-gems" ? dailyPick(unclaimed, show) : unclaimed.slice(0, show);
    for (const game of shelves[slug]) shown.add(game.appid);
  });
  return shelves;
}

export const BROWSE_PAGE_SIZE = 24;

/** "Browse all": every indie game (no companion apps), most-reviewed first. */
export async function getBrowsePage(offset: number): Promise<CardGame[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await getSupabaseServerClient().from("games").select(CARD_FIELDS).eq("is_indie", true).eq("is_companion", false)
    .order("review_count", { ascending: false }).order("appid").range(offset, offset + BROWSE_PAGE_SIZE - 1);
  if (error) throw new Error("Catalog unavailable");
  return data;
}

export async function getGamePageSlate(appid: number, developers: string[]) {
  "use cache";
  cacheLife("hours");
  const [all, developerGames] = await Promise.all([getRecommendations(appid), getDeveloperGames(appid, developers)]);
  return { developerGames, recs: all.filter(rec => !developerGames.some(game => game.appid === rec.game.appid)) };
}

/** Search's empty state: the curated picks with their art and ratings, drawn on the server so the panel opens complete.
 *  A failed read leaves the empty state blank rather than breaking every page. */
export async function getPopularIndies(): Promise<PopularPick[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await getSupabaseServerClient().from("games")
    .select("appid,title,header_image,release_date,review_positive_pct,review_count")
    .in("appid", POPULAR_INDIES.map(game => game.appid))
    .returns<PopularPick[]>();
  return POPULAR_INDIES.flatMap(pick => data?.find(row => row.appid === pick.appid) ?? []);
}
