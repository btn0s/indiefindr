import type { CardGame } from "@/lib/catalog";
import { clipUrl, pickTrailer } from "@/lib/trailer";

export const FIND_PCT = 92;
export const SECRET_PCT = 95;
export const FIND_REVIEWS = { min: 300, max: 5000 };
export const CLASSIC_REVIEWS = 20_000;
const FRESH_DAYS = 60;

export type PackGame = CardGame & {
  is_indie: boolean;
  release_date: string | null;
  is_early_access: boolean;
  tag_ids: number[] | null;
  trailers: unknown;
  short_description: string | null;
};

export type PackSet = { set: PackGame[]; frontier: { game: PackGame; via: number }[]; tags: Record<number, string>; today: string };

export type CardClass = "classic" | "cult" | "gem" | "secret" | "uncharted" | "prerelease";
export const FINDS: CardClass[] = ["gem", "secret"];

export type PackCard = {
  appid: number;
  title: string;
  cls: CardClass;
  rating: number | null;
  reviews: number;
  release: string | null;
  earlyAccess: boolean;
  fresh: boolean;
  image: string | null;
  art: string | null;
  still: string | null;
  clip: string | null;
  tags: string[];
  blurb: string | null;
  via: { appid: number; title: string } | null;
};

export function classify(game: Pick<PackGame, "release_date" | "review_count" | "review_positive_pct">, today: string): CardClass {
  if (!game.release_date || game.release_date > today) return "prerelease";
  const reviews = game.review_count;
  const pct = game.review_positive_pct ?? 0;
  if (reviews < FIND_REVIEWS.min) return "uncharted";
  if (reviews >= CLASSIC_REVIEWS) return "classic";
  if (reviews <= FIND_REVIEWS.max && pct >= SECRET_PCT) return "secret";
  if (reviews <= FIND_REVIEWS.max && pct >= FIND_PCT) return "gem";
  return "cult";
}

const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

function toCard(game: PackGame, { tags, today }: PackSet, via: PackGame | null): PackCard {
  const trailer = pickTrailer(game.trailers);
  const cls = classify(game, today);
  return {
    appid: game.appid,
    title: game.title,
    cls,
    rating: cls === "prerelease" || game.review_count < 10 ? null : game.review_positive_pct,
    reviews: game.review_count,
    release: game.release_date,
    earlyAccess: game.is_early_access,
    fresh: cls !== "prerelease" && !!game.release_date && daysBetween(game.release_date, today) <= FRESH_DAYS,
    image: game.header_image,
    art: null,
    still: game.hero_still ?? trailer?.poster ?? game.hero_poster ?? null,
    clip: trailer ? clipUrl(trailer) : null,
    tags: (game.tag_ids ?? []).slice(0, 3).flatMap(id => tags[id] ? [tags[id]] : []),
    blurb: game.short_description,
    via: via ? { appid: via.appid, title: via.title } : null,
  };
}

type Lane = "known" | "uncharted" | "prerelease";
const SLOTS: Lane[] = ["known", "uncharted", "known", "prerelease"];
const FALLBACK: Record<Lane, Lane[]> = {
  known: ["known", "uncharted", "prerelease"],
  uncharted: ["uncharted", "known", "prerelease"],
  prerelease: ["prerelease", "uncharted", "known"],
};
const laneOf = (cls: CardClass): Lane | "find" =>
  FINDS.includes(cls) ? "find" : cls === "uncharted" ? "uncharted" : cls === "prerelease" ? "prerelease" : "known";

export function deal(packSet: PackSet): PackCard[][] {
  const byId = new Map(packSet.set.map(game => [game.appid, game]));
  const lanes: Record<Lane | "find", PackCard[]> = { known: [], uncharted: [], prerelease: [], find: [] };
  for (const game of packSet.set) lanes[laneOf(classify(game, packSet.today))].push(toCard(game, packSet, null));
  const frontier = packSet.frontier.map(({ game, via }) => toCard(game, packSet, byId.get(via) ?? null));
  const packs: PackCard[][] = [];
  while (lanes.known.length + lanes.uncharted.length + lanes.prerelease.length + lanes.find.length > 0) {
    if (lanes.known.length + lanes.uncharted.length + lanes.prerelease.length === 0) {
      packs.push(lanes.find.splice(0, 5));
      continue;
    }
    const pack: PackCard[] = [];
    for (const slot of SLOTS) {
      const lane = FALLBACK[slot].find(name => lanes[name].length > 0);
      if (lane) pack.push(lanes[lane].shift()!);
    }
    const find = lanes.find.shift() ?? frontier.shift();
    if (find) pack.push(find);
    if (pack.length) packs.push(pack);
  }
  return packs;
}
