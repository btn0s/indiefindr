/**
 * A window the review-bomb model reports (scripts/relaunch/review_quality.py, docs/review-bomb-detection.md).
 * `up`/`down` are Steam's histogram counts, matching the review-history chart.
 * `steam_up`/`steam_down` are the same window in the headline score's population
 * (what clean_score subtracts). A bomb can draw counter-reviews, so up may exceed down.
 * Verdicts stored here:
 * - `bomb`: confirmed in hindsight (sentiment recovered, or the reviewers came from outside the game). Adjusted.
 * - `active_bomb`: still open; strong off-topic/coordination evidence from the reviews themselves. Adjusted.
 * - `unresolved`: still open; a sentiment break without enough evidence. Shown, not adjusted (`adjusted: false`).
 * Open windows are re-judged nightly and may flip to `bomb` or `decline` (declines are never stored).
 * Periods Steam itself flagged as off-topic are already out of Steam's score and never appear here.
 */
export type BombVerdict = 'bomb' | 'active_bomb' | 'unresolved';
export type BombWindow = {
  start: string;
  end: string;
  up: number;
  down: number;
  start_ts?: number;
  end_ts?: number;
  steam_up?: number;
  steam_down?: number;
  verdict?: BombVerdict;
  adjusted?: boolean;
  reason?: string;
  resolution?: string;
  shape?: { before_pct: number | null; during_pct: number | null; after_pct: number | null; recovery?: number; settled_gap?: number; live?: boolean };
};
export type ReviewQuality = { clean_score?: number | null; bomb_windows?: unknown; checked_at?: string | null };
export function bombWindows(value: unknown): BombWindow[] {
  return Array.isArray(value) ? value.filter((item): item is BombWindow => Boolean(item && typeof item === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(item.start) && /^\d{4}-\d{2}-\d{2}$/.test(item.end) && Number.isFinite(item.up) && Number.isFinite(item.down) && item.up + item.down > 0)) : [];
}
/** Windows clean_score left out. Rows from before v3 carry no `adjusted` flag and only ever stored negative-majority windows. */
const isAdjusted = (w: BombWindow) => w.adjusted ?? w.down > w.up;
export function adjustedWindows(value: unknown) {
  return bombWindows(value).filter(isAdjusted);
}
/** Possible bombs still being judged: shown with both numbers, score not adjusted. */
export function unresolvedWindows(value: unknown) {
  return bombWindows(value).filter((w) => w.verdict === 'unresolved' && !isAdjusted(w));
}
export function isRescued(game: ReviewQuality & { review_positive_pct: number | null; review_count: number }) {
  return game.review_count >= 10 && game.review_positive_pct !== null && game.review_positive_pct < 70 && (game.clean_score ?? 0) >= 70 && adjustedWindows(game.bomb_windows).length > 0;
}
export function recommendationEligible(game: ReviewQuality & { review_positive_pct: number | null; review_count: number }) {
  return game.review_count < 10 || game.review_positive_pct === null || game.review_positive_pct >= 70 || isRescued(game);
}
export function qualityFields(game: ReviewQuality & { review_positive_pct: number | null; review_count: number }) {
  return { steam_score: game.review_positive_pct, clean_score: game.clean_score ?? null, bomb_windows: bombWindows(game.bomb_windows), checked_at: game.checked_at ?? null, review_bombed: isRescued(game) };
}

const DAY = 86400;
const ordinal = ['once', 'twice', 'three times', 'four times', 'five times'];
const listOf = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const monthOf = (stamp: number) => new Date(stamp * 1000);
const monthName = (stamp: number, month: 'short' | 'long', year = true) =>
  monthOf(stamp).toLocaleDateString('en-US', { month, ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });

/**
 * A window as a half-open span of Unix seconds. Month windows are stored as Pacific dates; `days`
 * keeps the Pacific dates of a weekly or daily window for display. `steamUp`/`steamDown` count the
 * window in the population of Steam's score (histogram counts for rows from before v3).
 */
export type BombSpan = {
  start: number;
  end: number;
  up: number;
  down: number;
  steamUp: number;
  steamDown: number;
  verdict?: BombVerdict;
  reason?: string;
  days?: { first: string; last: string };
};
const toSpan = (w: BombWindow): BombSpan => ({
  start: w.start_ts ?? Date.parse(`${w.start}T00:00:00Z`) / 1000 + DAY,
  end: w.end_ts ?? Date.parse(`${w.end}T00:00:00Z`) / 1000 + 2 * DAY,
  up: w.up,
  down: w.down,
  steamUp: w.steam_up ?? w.up,
  steamDown: w.steam_down ?? w.down,
  ...(w.verdict ? { verdict: w.verdict } : {}),
  ...(w.reason ? { reason: w.reason } : {}),
  ...(w.resolution && w.resolution !== 'month' ? { days: { first: w.start, last: w.end } } : {}),
});
const oldestFirst = (a: BombSpan, b: BombSpan) => a.start - b.start;
/** Adjusted windows (what clean_score left out), oldest first. An `active_bomb` span is still being judged. */
export function bombSpans(value: unknown): BombSpan[] {
  return adjustedWindows(value).map(toSpan).sort(oldestFirst);
}

/** "Aug–Oct 2023", "Oct 2023", "Dec 2022–Feb 2023"; `long` spells the months out. */
export function monthRange(start: number, end: number, month: 'short' | 'long' = 'short') {
  const last = end - DAY;
  const sameYear = monthOf(start).getUTCFullYear() === monthOf(last).getUTCFullYear();
  if (sameYear && monthOf(start).getUTCMonth() === monthOf(last).getUTCMonth()) return monthName(start, month);
  return `${monthName(start, month, !sameYear)}–${monthName(last, month)}`;
}

const yearsOf = (spans: BombSpan[]) => [...new Set(spans.map((s) => String(monthOf(s.start).getUTCFullYear())))];
const dayName = (iso: string, year: boolean) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });

/** "Aug–Oct 2023" for a month window, "Aug 25–31, 2026" for a weekly or daily one; `long` spells the months out. */
export function spanRange(span: BombSpan, month: 'short' | 'long' = 'short') {
  if (!span.days) return monthRange(span.start, span.end, month);
  const { first, last } = span.days;
  const name = (iso: string, parts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { ...parts, timeZone: 'UTC' });
  if (first === last) return name(first, { month, day: 'numeric', year: 'numeric' });
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `${name(first, { month, day: 'numeric' })}–${name(last, sameMonth ? { day: 'numeric' } : { month, day: 'numeric' })}, ${last.slice(0, 4)}`;
}

/** "from August to October 2023", "in October 2023", "from August 25 to 31, 2026". */
function when(span: BombSpan) {
  if (span.days) {
    const { first, last } = span.days;
    if (first === last) return `on ${dayName(first, true)}`;
    const sameMonth = first.slice(0, 7) === last.slice(0, 7);
    return `from ${dayName(first, false)} to ${sameMonth ? Number(last.slice(8)) : dayName(last, false)}, ${last.slice(0, 4)}`;
  }
  const range = monthRange(span.start, span.end, 'long');
  return range.includes('–') ? `from ${range.replace('–', ' to ')}` : `in ${range}`;
}

const tally = (spans: BombSpan[]) => ({
  up: spans.reduce((n, s) => n + s.up, 0),
  down: spans.reduce((n, s) => n + s.down, 0),
  steam: spans.reduce((n, s) => n + s.steamUp + s.steamDown, 0),
  steamUp: spans.reduce((n, s) => n + s.steamUp, 0),
});
const size = (spans: BombSpan[], soFar = false) => {
  const { up, down } = tally(spans);
  const across = spans.length === 1 ? '' : spans.length === 2 ? ' across both' : ` across all ${spans.length}`;
  return `${(up + down).toLocaleString('en-US')} reviews${soFar ? ' so far' : ''}${across}, ${Math.round((100 * down) / (up + down))}% negative`;
};

/** A review bomb has to move the score at least this many points for the page to mention it. */
const NOTEWORTHY = 3;
/** A window that ended this recently is described as still going on. */
const ONGOING = 14 * DAY;

/**
 * What a game page says about review bombs, or null when there's nothing worth saying. Every kind has to
 * move Steam's score by at least NOTEWORTHY points.
 * - `past`: confirmed bombs.
 * - `active`: a bomb still being judged, already set aside on the reviews' own evidence.
 * - `possible`: a sudden wave of negative reviews still being judged and not set aside, shown with both scores.
 * `steam` is Steam's score; `without` is the same population without the windows the story sets aside
 * (or, for a possible bomb, would set aside). The chart and ledger count Steam's review history instead.
 */
export type BombStory = {
  kind: 'past' | 'active' | 'possible';
  spans: BombSpan[];
  steam: { pct: number; count: number };
  without: { pct: number; count: number };
  headline: string;
  detail: string;
};
export function bombStory(game: ReviewQuality & { title: string; review_positive_pct: number | null; review_count: number }): BombStory | null {
  const pct = game.review_positive_pct;
  if (pct === null || game.review_count < 10) return null;
  const adjusted = bombSpans(game.bomb_windows);
  const possible = unresolvedWindows(game.bomb_windows).map(toSpan).sort(oldestFirst);
  const active = adjusted.filter((s) => s.verdict === 'active_bomb');
  const past = adjusted.filter((s) => s.verdict !== 'active_bomb');
  const clean = Math.round(game.clean_score ?? pct);
  const steam = { pct, count: game.review_count };
  /** Steam's population without these windows: how many reviews are left, and the share positive. */
  const leftOver = (spans: BombSpan[]) => {
    const removed = tally(spans);
    const count = game.review_count - removed.steam;
    return { count, pct: Math.round((100 * (Math.round((game.review_count * pct) / 100) - removed.steamUp)) / count) };
  };
  const ifSetAside = leftOver([...adjusted, ...possible]);
  const kind = clean - pct >= NOTEWORTHY ? (active.length ? 'active' : past.length ? 'past' : null)
    : possible.length && ifSetAside.pct - pct >= NOTEWORTHY ? 'possible' : null;
  if (!kind) return null;

  const checked = Date.parse(game.checked_at ?? '') / 1000 || Date.now() / 1000;
  const ongoing = (span: BombSpan) => checked - span.end < ONGOING;
  const without = kind === 'possible' ? ifSetAside : { count: leftOver(adjusted).count, pct: clean };
  const title = game.title;
  const latest = (spans: BombSpan[]) => spans.at(-1)!;

  let headline: string;
  let detail: string;
  if (kind === 'past') {
    const times = ordinal[past.length - 1] ?? `${past.length} times`;
    const years = yearsOf(past);
    headline = past.length === 1 ? `${title} was review-bombed ${when(past[0])}.`
      : years.length === 1 ? `${title} was review-bombed ${times} in ${years[0]}.`
      : `${title} was review-bombed ${times}, in ${listOf(years)}.`;
    detail = `${size(past)}. Without ${past.length === 1 ? 'those reviews' : 'them'}, players rate it ${clean}%.`;
  } else if (kind === 'active') {
    const now = latest(active);
    headline = ongoing(now) ? `${title} is being review-bombed. It started on ${dayName(now.days?.first ?? new Date(now.start * 1000).toISOString().slice(0, 10), true)}.`
      : `${title} was review-bombed ${when(now)}.`;
    detail = `${size(active, ongoing(now))}. The reviews themselves point to a campaign, so they're set aside: without them, players rate it ${clean}%.${ongoing(now) ? '' : ' It’s recent, so we look at it again every night.'}`;
  } else {
    const now = latest(possible);
    headline = ongoing(now) ? `${title} has had a sudden wave of negative reviews since ${dayName(now.days?.first ?? new Date(now.start * 1000).toISOString().slice(0, 10), true)}.`
      : `${title} got a sudden wave of negative reviews ${when(now)}.`;
    detail = `${size(possible, ongoing(now))}. It may be a review bomb, but there isn’t enough evidence yet to set them aside, so Steam’s ${pct}% stands. Without them it would be ${without.pct}%.`;
  }
  if (kind !== 'possible' && possible.length)
    detail += ` A newer wave of negative reviews ${when(latest(possible))} may be another; it isn’t set aside yet.`;
  return { kind, spans: [...adjusted, ...possible].sort(oldestFirst), steam, without, headline, detail };
}

export type LedgerRow = { kind: 'before' | 'bomb' | 'between' | 'since'; start: number; end: number; up: number; down: number };
/** Reviews split into the stretches before, during, between and since the bombs. Bomb rows use the detector's own tallies; a period that touches a bomb counts only there. */
export function reviewLedger(spans: BombSpan[], periods: { start: number; end: number; up: number; down: number }[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const quiet = (from: number, to: number, kind: LedgerRow['kind']) => {
    const inside = periods.filter((p) => p.start >= from && p.start < to && !spans.some((s) => p.start < s.end && p.end > s.start));
    const up = inside.reduce((n, p) => n + p.up, 0);
    const down = inside.reduce((n, p) => n + p.down, 0);
    if (up + down) rows.push({ kind, start: inside[0].start, end: inside.at(-1)!.end, up, down });
  };
  spans.forEach((s, i) => {
    quiet(i ? spans[i - 1].end : -Infinity, s.start, i ? 'between' : 'before');
    rows.push({ kind: 'bomb', ...s });
  });
  if (spans.length) quiet(spans.at(-1)!.end, Infinity, 'since');
  return rows;
}
