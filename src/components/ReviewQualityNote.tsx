import { bombWindows, isRescued, type ReviewQuality } from '@/lib/review-quality';
export function ReviewQualityNote({ game }: { game: ReviewQuality & { title: string; review_positive_pct: number | null; review_count: number } }) {
  if (!isRescued(game)) return null;
  const periods = bombWindows(game.bomb_windows).sort((a,b) => b.end.localeCompare(a.end));
  const latest = periods[0];
  const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const earlier = periods.length - 1;
  return <p className="review-quality-note">Review bombing detected. From {date(latest.start)} to {date(latest.end)}{earlier > 0 && ` (and ${earlier} earlier ${earlier === 1 ? 'period' : 'periods'})`}, this game received an unusual surge of negative reviews. Its Steam rating of {game.review_positive_pct}% includes them; reviews outside that period are {game.clean_score!.toLocaleString('en-US', { maximumFractionDigits: 1 })}% positive. <a href={`https://www.google.com/search?q=${encodeURIComponent(`${game.title} review bombing`)}`} target="_blank" rel="noopener">Learn more ↗</a></p>;
}
