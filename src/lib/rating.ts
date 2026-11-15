export function steamRating(positivePct: number | null, count: number): string | null {
  if (positivePct == null || count < 10) return null;
  if (positivePct >= 95 && count >= 500) return "Overwhelmingly Positive";
  if (positivePct >= 80) return count >= 50 ? "Very Positive" : "Positive";
  if (positivePct >= 70) return "Mostly Positive";
  if (positivePct >= 40) return "Mixed";
  if (positivePct >= 20) return "Mostly Negative";
  return count >= 500 ? "Overwhelmingly Negative" : count >= 50 ? "Very Negative" : "Negative";
}

export type RatingTone = "positive" | "mixed" | "negative";
export const ratingTone = (label: string): RatingTone =>
  label === "Mixed" ? "mixed" : label.endsWith("Positive") ? "positive" : "negative";

export const compactCount = (count: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(count);
