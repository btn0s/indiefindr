import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". The label and the bomb flag are units (globals.css): a narrow card breaks
 *  between them, never inside one. */
export function CardRating({ pct, count }: { pct: number | null; count: number }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <p className="card-rating"><strong>{pct}%</strong> <span className="rating-label">{label}</span></p>;
}

