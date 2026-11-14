import { steamRating } from "@/lib/rating";

const SHORT_LABELS: Record<string, string> = { "Overwhelmingly Positive": "Overwhelming" };

/** Card line: "97% Overwhelmingly Positive". The label and the bomb flag are units (globals.css): a narrow card breaks
 *  between them, never inside one. */
export function CardRating({ pct, count, compact = false }: {
  pct: number | null; count: number;
  /** On a card that can be narrower than "Overwhelmingly Positive" (a box card on a phone), that label gives way to a
   *  short one there rather than wrapping onto a third line (globals.css). Screen readers still get the whole label. */
  compact?: boolean;
}) {
  const label = steamRating(pct, count);
  if (!label) return null;
  const short = compact ? SHORT_LABELS[label] : undefined;
  return <p className="card-rating"><strong>{pct}%</strong> <span className="rating-label">
    {short ? <><span className="rating-long">{label}</span><span className="rating-short" aria-hidden="true">{short}</span></> : label}
  </span></p>;
}

