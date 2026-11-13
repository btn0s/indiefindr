import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". */
export function CardRating({ pct, count }: { pct: number | null; count: number }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return <p className="card-rating"><strong>{pct}%</strong> {label}</p>;
}

