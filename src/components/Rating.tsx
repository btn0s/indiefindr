import { compactCount, steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". */
export function CardRating({ pct, count }: { pct: number | null; count: number }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <p className="card-rating"><strong>{pct}%</strong> {label}</p>;
}

/** Game page: the score as the headline, with Steam's label and review volume. */
export function RatingBadge({ pct, count }: { pct: number | null; count: number }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <div className="rating-badge" title={`${pct}% of ${count.toLocaleString("en-US")} Steam reviews are positive`}>
    <strong>{pct}%</strong>
    <span><b>{label}</b><small>{compactCount(count)} <span className="rating-source">Steam </span>reviews</small></span>
  </div>;
}
