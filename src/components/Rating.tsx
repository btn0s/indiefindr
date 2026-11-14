import { steamRating } from "@/lib/rating";

/** Card line: "97% Overwhelmingly Positive". */
export function CardRating({
  pct,
  count,
  rescued = false,
  cleanScore,
}: {
  pct: number | null;
  count: number;
  rescued?: boolean;
  cleanScore?: number | null;
}) {
  const label = steamRating(pct, count);
  if (!label) return null;
  return (
    <p className="card-rating">
      <strong>{pct}%</strong> {label}
      {rescued && cleanScore != null && (
        <span className="clean-score-badge">
          {" "}
          {cleanScore.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
          outside
        </span>
      )}
    </p>
  );
}
