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
