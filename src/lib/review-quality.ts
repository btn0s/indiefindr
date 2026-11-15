import { steamRating } from "@/lib/rating";

type BombWindow = {
  start: string;
  end: string;
  up: number;
  down: number;
  start_ts?: number;
  end_ts?: number;
  steam_up?: number;
  steam_down?: number;
  verdict?: "bomb" | "active_bomb" | "unresolved";
  adjusted?: boolean;
};
export type ReviewQuality = { clean_score?: number | null; bomb_windows?: unknown; checked_at?: string | null };
type RatedGame = ReviewQuality & { review_positive_pct: number | null; review_count: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function adjustedWindows(value: unknown): BombWindow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((w): w is BombWindow => Boolean(w && typeof w === "object" && DATE.test(w.start) && DATE.test(w.end)
    && Number.isFinite(w.up) && Number.isFinite(w.down) && w.up + w.down > 0 && (w.adjusted ?? w.down > w.up)));
}

export type Rating = { pct: number; label: string };

export type ReviewBomb = {
  ratingBefore: Rating;
  ratingNow: Rating;
  when: { start: string; end: string };
  active: boolean;
};

const DAY = 86400;
const utcDate = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
const steamCount = (w: BombWindow) => (w.steam_up ?? w.up) + (w.steam_down ?? w.down);
const daysOf = (w: BombWindow) =>
  w.start_ts && w.end_ts ? { start: utcDate(w.start_ts), end: utcDate(w.end_ts - DAY) } : { start: w.start, end: w.end };

export function reviewBomb(game: RatedGame): ReviewBomb | null {
  const pct = game.review_positive_pct;
  const clean = game.clean_score;
  if (pct === null || clean == null || game.review_count < 10 || pct >= 70 || clean < 70) return null;
  const windows = adjustedWindows(game.bomb_windows);
  if (!windows.length) return null;
  const biggest = windows.reduce((a, b) => (steamCount(b) > steamCount(a) ? b : a));
  const before = { pct: Math.round(clean), count: game.review_count - windows.reduce((n, w) => n + steamCount(w), 0) };
  const labelBefore = steamRating(before.pct, before.count);
  if (!labelBefore) return null;
  return {
    ratingBefore: { pct: before.pct, label: labelBefore },
    ratingNow: { pct, label: steamRating(pct, game.review_count)! },
    when: daysOf(biggest),
    active: windows.some((w) => w.verdict === "active_bomb"),
  };
}

export function recommendationEligible(game: RatedGame) {
  return game.review_count < 10 || game.review_positive_pct === null || game.review_positive_pct >= 70 || reviewBomb(game) !== null;
}
