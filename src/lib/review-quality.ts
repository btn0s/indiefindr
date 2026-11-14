import { steamRating } from "@/lib/rating";

/**
 * A window the review-bomb model reports (scripts/relaunch/review_quality.py, docs/review-bomb-detection.md).
 * `steam_up`/`steam_down` count the window in the headline score's population (what clean_score subtracts);
 * `up`/`down` are Steam's histogram counts. Verdicts stored here:
 * - `bomb`: confirmed in hindsight (sentiment recovered, or the reviewers came from outside the game). Adjusted.
 * - `active_bomb`: still open; strong off-topic/coordination evidence from the reviews themselves. Adjusted.
 * - `unresolved`: still open; a sentiment break without enough evidence. Not adjusted (`adjusted: false`).
 * Open windows are re-judged nightly and may flip to `bomb` or `decline` (declines are never stored).
 */
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
/** The stored review-quality columns on a game row. */
export type ReviewQuality = { clean_score?: number | null; bomb_windows?: unknown; checked_at?: string | null };
type RatedGame = ReviewQuality & { review_positive_pct: number | null; review_count: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Windows clean_score left out. Rows from before v3 carry no `adjusted` flag and only ever stored negative-majority windows. */
function adjustedWindows(value: unknown): BombWindow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((w): w is BombWindow => Boolean(w && typeof w === "object" && DATE.test(w.start) && DATE.test(w.end)
    && Number.isFinite(w.up) && Number.isFinite(w.down) && w.up + w.down > 0 && (w.adjusted ?? w.down > w.up)));
}

/** Steam's rating, as Steam would label it: `{ pct: 61, label: "Mixed" }`. */
export type Rating = { pct: number; label: string };

/**
 * Why a game Steam rates Mixed or below is still worth showing: a review bomb put it there. Present only when
 * Steam's rating today is Mixed or below (under 70%) and the same reviews without the bomb rate it Mostly Positive
 * or better (70% or more). A bomb that no longer drags the rating out of the positive range is not reported.
 */
export type ReviewBomb = {
  /** The rating without the bomb's reviews: Steam's own reviews, minus those written during the bomb. */
  ratingBefore: Rating;
  /** Steam's rating today, bomb included. */
  ratingNow: Rating;
  /** The bomb's first and last day (UTC, inclusive, YYYY-MM-DD). With several bombs, the one with the most reviews. */
  when: { start: string; end: string };
  /** True while the bomb is still going on: its reviews are already set aside, and it is re-judged every night. */
  active: boolean;
};

const DAY = 86400;
const utcDate = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
const steamCount = (w: BombWindow) => (w.steam_up ?? w.up) + (w.steam_down ?? w.down);
/** The window as UTC days. Stored dates are Pacific; the epoch bounds are the histogram's own (UTC) buckets. */
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

/** Recommendation targets skip games Steam rates under 70%, unless a review bomb is what put them there. */
export function recommendationEligible(game: RatedGame) {
  return game.review_count < 10 || game.review_positive_pct === null || game.review_positive_pct >= 70 || reviewBomb(game) !== null;
}
