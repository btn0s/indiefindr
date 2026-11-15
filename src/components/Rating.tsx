import { ThumbsDown, ThumbsUp } from "lucide-react";
import { ratingTone, steamRating } from "@/lib/rating";

export function RatingChip({ pct, count }: { pct: number | null; count: number }) {
  const label = steamRating(pct, count);
  if (!label) return null;
  const tone = ratingTone(label);
  const Thumb = tone === "positive" ? ThumbsUp : tone === "negative" ? ThumbsDown : null;
  const name = `${pct}% ${label} on Steam`;
  return <span className="rating-chip" data-tone={tone} role="img" aria-label={name} title={name}>
    {Thumb && <Thumb aria-hidden="true" strokeWidth={2.25} />}{pct}%
  </span>;
}
