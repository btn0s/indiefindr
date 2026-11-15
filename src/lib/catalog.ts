import { recommendationEligible, type ReviewQuality } from "@/lib/review-quality";
import { cacheLife } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { HERO_FIELDS } from "@/lib/hero";
import { POPULAR_INDIES } from "@/lib/popular-indies";
import { getBoxArt } from "@/lib/steam-art";
import type { PopularPick } from "@/lib/use-game-search";
import { FIND_PCT, FIND_REVIEWS, type PackGame, type PackSet } from "@/lib/packs";

export async function getGame(appid: number) {
  "use cache";
  cacheLife("hours");
  const { data, error } = await getSupabaseServerClient()
    .from("games")
    .select("appid,title,short_description,header_image,developers,publishers,release_date,genres,review_count,review_positive_pct,clean_score,bomb_windows,checked_at,price_cents,is_free,is_indie,screenshots,trailers")
    .eq("appid", appid)
    .maybeSingle();
  if (error) throw new Error("Catalog unavailable");
  return data;
}

export type RecommendationCard = {
  rank: number;
  source: "llm" | "model";
  game: CardGame & { is_indie: boolean };
};

type SlateGame = CardGame & { is_indie: boolean };

async function readSlate<G extends SlateGame>(appid: number, fields: string): Promise<{ rank: number; source: "llm" | "model"; game: G }[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select(`rank,source,game:games!game_recs_rec_appid_fkey!inner(${fields},is_indie)`)
    .eq("appid", appid)
    .eq("game.is_indie", true)
    .eq("game.is_companion", false)
    .order("rank");
  if (error) throw new Error("Recommendations unavailable");
  const recs = (data ?? []) as unknown as { rank: number; source: "llm" | "model"; game: G }[];
  const seen = new Set<number>();
  return [...recs.filter(rec => rec.source === "llm"), ...recs.filter(rec => rec.source === "model")]
    .filter(rec => recommendationEligible(rec.game))
    .filter(rec => rec.game.appid !== appid && !seen.has(rec.game.appid) && seen.add(rec.game.appid));
}

export async function getRecommendations(appid: number): Promise<RecommendationCard[]> {
  "use cache";
  cacheLife("hours");
  return readSlate(appid, CARD_FIELDS);
}

export async function getPackSet(appid: number): Promise<PackSet> {
  "use cache";
  cacheLife("hours");
  const today = new Date().toISOString().slice(0, 10);
  const set = (await readSlate<PackGame>(appid, PACK_FIELDS)).map(({ game }) => game);
  const members = new Set([appid, ...set.map(game => game.appid)]);
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select(`appid,rank,game:games!game_recs_rec_appid_fkey!inner(${PACK_FIELDS},is_indie)`)
    .in("appid", set.map(game => game.appid))
    .eq("game.is_indie", true)
    .eq("game.is_companion", false)
    .lte("game.release_date", today)
    .gte("game.review_count", FIND_REVIEWS.min)
    .lte("game.review_count", FIND_REVIEWS.max)
    .gte("game.review_positive_pct", FIND_PCT)
    .order("rank")
    .limit(1000);
  if (error) throw new Error("Recommendations unavailable");
  const position = new Map(set.map((game, index) => [game.appid, index]));
  const reach = new Map<number, { game: PackGame; via: number; votes: Set<number>; best: number }>();
  for (const row of ((data ?? []) as unknown as { appid: number; rank: number; game: PackGame }[]).filter(row => recommendationEligible(row.game))) {
    if (members.has(row.game.appid)) continue;
    const score = (position.get(row.appid) ?? 0) * 100 + row.rank;
    const entry = reach.get(row.game.appid) ?? { game: row.game, via: row.appid, votes: new Set<number>(), best: score };
    entry.votes.add(row.appid);
    if (score < entry.best) Object.assign(entry, { via: row.appid, best: score });
    reach.set(row.game.appid, entry);
  }
  const frontier = [...reach.values()]
    .sort((a, b) => b.votes.size - a.votes.size || a.best - b.best)
    .map(({ game, via }) => ({ game, via }));
  const tagIds = [...new Set([...set, ...frontier.map(({ game }) => game)].flatMap(game => (game.tag_ids ?? []).slice(0, 3)))];
  const { data: tags } = tagIds.length ? await getSupabaseServerClient().from("tags").select("id,name").in("id", tagIds) : { data: [] };
  return { set, frontier, tags: Object.fromEntries((tags ?? []).map(tag => [tag.id, tag.name])), today };
}

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

export const CARD_FIELDS = `appid,title,header_image,review_count,review_positive_pct,clean_score,bomb_windows,checked_at,${HERO_FIELDS}`;
const PACK_FIELDS = `${CARD_FIELDS},release_date,is_early_access,tag_ids,trailers,short_description`;

export type CardGame = ReviewQuality & {
  appid: number; title: string; header_image: string | null; review_count: number; review_positive_pct: number | null;
  hero_poster: string | null; hero_still: string | null;
};
type ShelfGame = CardGame;
const SHELF_FIELDS = CARD_FIELDS;
export type BoxGame = CardGame & { cover: string | null };
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

function dailyPick<T>(items: T[], count: number): T[] {
  let seed = Math.floor(Date.now() / 86_400_000);
  const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

const shelfBase = () => getSupabaseServerClient().from("games").select(SHELF_FIELDS)
  .eq("is_indie", true).eq("indie_plus", false).eq("is_adult", false).eq("is_companion", false);
type ShelfQuery = ReturnType<typeof shelfBase>;

export const SHELVES = {
  rising: {
    title: "Rising", note: "Indies picking up players right now",
    query: (q: ShelfQuery) => q.not("momentum", "is", null).eq("is_early_access", false).order("momentum", { ascending: false }).order("appid"),
  },
  "early-access": {
    title: "Early Access", note: "In-development indies players are flocking to",
    query: (q: ShelfQuery) => q.not("momentum", "is", null).eq("is_early_access", true).order("momentum", { ascending: false }).order("appid"),
  },
  upcoming: {
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

const HOME_SHELVES: { slug: ShelfSlug; fetch: number; show: number }[] = [
  { slug: "rising", fetch: 12, show: 12 },
  { slug: "early-access", fetch: 24, show: 12 },
  { slug: "new", fetch: 24, show: 12 },
  { slug: "upcoming", fetch: 20, show: 12 },
  { slug: "hidden-gems", fetch: 240, show: 12 },
];

export async function getHomeShelves() {
  "use cache";
  cacheLife("hours");
  const fetched = await Promise.all(HOME_SHELVES.map(({ slug, fetch }) => getShelf(slug, fetch)));
  const shown = new Set<number>();
  const picked = {} as Record<ShelfSlug, ShelfGame[]>;
  HOME_SHELVES.forEach(({ slug, show }, index) => {
    const unclaimed = fetched[index].filter(game => !shown.has(game.appid));
    picked[slug] = slug === "hidden-gems" ? dailyPick(unclaimed, show) : unclaimed.slice(0, show);
    for (const game of picked[slug]) shown.add(game.appid);
  });
  const art = await getBoxArt([...shown]).catch((): Record<number, string> => ({}));
  const shelves = {} as Record<ShelfSlug, BoxGame[]>;
  for (const { slug } of HOME_SHELVES) shelves[slug] = picked[slug].map(game => ({ ...game, cover: art[game.appid] ?? null }));
  return shelves;
}

export const BROWSE_PAGE_SIZE = 24;

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

export async function getPopularIndies(): Promise<PopularPick[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await getSupabaseServerClient().from("games")
    .select("appid,title,header_image,release_date,review_positive_pct,review_count")
    .in("appid", POPULAR_INDIES.map(game => game.appid))
    .returns<PopularPick[]>();
  return POPULAR_INDIES.flatMap(pick => data?.find(row => row.appid === pick.appid) ?? []);
}
