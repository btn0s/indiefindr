import { steamRating } from "@/lib/rating";

type BombWindow = { start: string; end: string };
function isWindow(value: unknown): value is BombWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as Record<string, unknown>;
  return typeof window.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(window.start)
    && typeof window.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(window.end);
}

/** A statistical spike is disclosed as a spike; Steam's real label stays above. */
export function ReviewQualityNote({ score, cleanScore, count, windows }: {
  score: number | null; cleanScore: number | null; count: number; windows: unknown;
}) {
  if (!steamRating(score, count) || score === null || score >= 70 || cleanScore === null || cleanScore < 70) return null;
  const periods = Array.isArray(windows) ? windows.filter(isWindow) : [];
  if (!periods.length) return null;
  const month = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const dates = [...new Set(periods.flatMap(period => [month(period.start), month(period.end)]))];
  const summary = dates.length <= 2 ? dates.join("–") : `${dates[0]}–${dates[dates.length - 1]}`;
  return <p className="review-quality-note">Review {periods.length === 1 ? "spike" : "spikes"} detected {summary}; {cleanScore.toLocaleString("en-US", { maximumFractionDigits: 1 })}% positive outside {periods.length === 1 ? "that window" : "those windows"}. <span>Both positive and negative reviews in the detected {periods.length === 1 ? "window are" : "windows are"} excluded from this adjusted score.</span></p>;
}
