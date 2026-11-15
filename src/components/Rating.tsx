import { ThumbsDown, ThumbsUp } from "lucide-react";
import { ratingTone, steamRating } from "@/lib/rating";

/** A game's Steam rating as a small chip: a thumb and the share of positive reviews, coloured by the way Steam's label
 *  leans (globals.css): green with a thumb up for Mostly Positive and better, amber with no thumb for Mixed, red with a
 *  thumb down below. The label isn't shown; the chip's name and tooltip carry Steam's whole wording. Nothing for a game
 *  with too few reviews to rate. */
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
