export type BombWindow = { start: string; end: string; up: number; down: number; start_ts?: number; end_ts?: number };
export type ReviewQuality = { clean_score?: number | null; bomb_windows?: unknown; checked_at?: string | null };
export function bombWindows(value: unknown): BombWindow[] {
  return Array.isArray(value) ? value.filter((item): item is BombWindow => Boolean(item && typeof item === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(item.start) && /^\d{4}-\d{2}-\d{2}$/.test(item.end) && Number.isFinite(item.up) && Number.isFinite(item.down) && item.down > item.up)) : [];
}
export function isRescued(game: ReviewQuality & { review_positive_pct: number | null; review_count: number }) {
  return game.review_count >= 10 && game.review_positive_pct !== null && game.review_positive_pct < 70 && (game.clean_score ?? 0) >= 70 && Array.isArray(game.bomb_windows) && game.bomb_windows.length > 0 && bombWindows(game.bomb_windows).length === game.bomb_windows.length;
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

/** A detected window as a half-open span of Unix seconds, oldest first. Month windows are stored as Pacific dates. */
export type BombSpan = { start: number; end: number; up: number; down: number };
export function bombSpans(value: unknown): BombSpan[] {
  return bombWindows(value)
    .map((w) => ({
      start: w.start_ts ?? Date.parse(`${w.start}T00:00:00Z`) / 1000 + DAY,
      end: w.end_ts ?? Date.parse(`${w.end}T00:00:00Z`) / 1000 + 2 * DAY,
      up: w.up,
      down: w.down,
    }))
    .sort((a, b) => a.start - b.start);
}

/** "Aug–Oct 2023", "Oct 2023", "Dec 2022–Feb 2023"; `long` spells the months out. */
export function monthRange(start: number, end: number, month: 'short' | 'long' = 'short') {
  const last = end - DAY;
  const sameYear = monthOf(start).getUTCFullYear() === monthOf(last).getUTCFullYear();
  if (sameYear && monthOf(start).getUTCMonth() === monthOf(last).getUTCMonth()) return monthName(start, month);
  return `${monthName(start, month, !sameYear)}–${monthName(last, month)}`;
}

const yearsOf = (spans: BombSpan[]) => [...new Set(spans.map((s) => String(monthOf(s.start).getUTCFullYear())))];

/** The banner's first sentence: what happened and when. */
export function bombHeadline(title: string, spans: BombSpan[]) {
  if (spans.length === 1) {
    const range = monthRange(spans[0].start, spans[0].end, 'long');
    return range.includes('–') ? `${title} was review-bombed from ${range.replace('–', ' to ')}.` : `${title} was review-bombed in ${range}.`;
  }
  const times = ordinal[spans.length - 1] ?? `${spans.length} times`;
  const years = yearsOf(spans);
  return years.length === 1 ? `${title} was review-bombed ${times} in ${years[0]}.` : `${title} was review-bombed ${times}, in ${listOf(years)}.`;
}

/** The banner's second sentence: how big it was, and the score without it. */
export function bombDetail(spans: BombSpan[], cleanScore: number) {
  const up = spans.reduce((n, s) => n + s.up, 0);
  const down = spans.reduce((n, s) => n + s.down, 0);
  const across = spans.length === 1 ? '' : spans.length === 2 ? ' across both' : ` across all ${spans.length}`;
  const them = spans.length === 1 ? 'those reviews' : 'them';
  return `${(up + down).toLocaleString('en-US')} reviews${across}, ${Math.round((100 * down) / (up + down))}% negative. Without ${them}, players rate it ${cleanScore}%.`;
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
