import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". */
export function CardRating({ pct, count, rescued = false }: { pct: number | null; count: number; rescued?: boolean }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <p className="card-rating"><strong>{pct}%</strong> {label}{rescued && <span className="review-bombed-label"> Review bombed</span>}</p>;
}

