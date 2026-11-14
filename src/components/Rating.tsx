import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". The label and the bomb flag are units (globals.css): a narrow card breaks
 *  between them, never inside one. */
export function CardRating({ pct, count, rescued = false }: { pct: number | null; count: number; rescued?: boolean }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <p className="card-rating"><strong>{pct}%</strong> <span className="rating-label">{label}</span>{rescued && <> <span className="review-bombed-label">Review bombed</span></>}</p>;
}

