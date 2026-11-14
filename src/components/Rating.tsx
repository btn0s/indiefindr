import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". A review-bombed game's adjusted score gets a quiet line saying so. */
export function CardRating({
  pct,
  count,
  bombs = 0,
}: {
  pct: number | null;
  count: number;
  /** How many review bombs the score is adjusted for. */
  bombs?: number;
}) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return (
    <p className="card-rating">
      <strong>{pct}%</strong> {label}
      {bombs > 0 && (
        <span className="card-adjusted">
          Adjusted for {bombs > 1 ? "review bombs" : "a review bomb"}
        </span>
      )}
    </p>
  );
}
