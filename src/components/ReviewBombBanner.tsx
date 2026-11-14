"use client";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import {
  bombDetail,
  bombHeadline,
  monthRange,
  reviewLedger,
  type BombSpan,
  type LedgerRow,
} from "@/lib/review-quality";
import type { ReviewHistory, ReviewPeriod } from "@/lib/review-history";
import { ReviewHistoryChart } from "@/components/ReviewHistoryChart";

const count = (n: number) => n.toLocaleString("en-US");
const share = (up: number, down: number) => Math.round((100 * up) / (up + down));
const plural = (spans: BombSpan[]) => (spans.length > 1 ? "review bombs" : "review bomb");

/**
 * A review-bombed game's history, in normal flow under its facts: what happened in a sentence,
 * with the review history beside it. Pressing it opens the full history.
 */
export function ReviewBombBanner({
  title,
  steam,
  cleanScore,
  spans,
  history,
}: {
  title: string;
  steam: { pct: number; count: number };
  cleanScore: number;
  spans: BombSpan[];
  history: ReviewHistory | null;
}) {
  const periods = history?.periods ?? [];
  const unit = history?.granularity === "week" ? "week" : history?.granularity === "day" ? "day" : "month";
  const headline = bombHeadline(title, spans);
  const detail = bombDetail(spans, cleanScore);
  return (
    <Dialog presentation="auto">
      <DialogTrigger className="bomb-banner">
        <span className="bomb-banner-text">
          <span className="bomb-banner-eyebrow">Review history</span>
          <span className="bomb-banner-headline">{headline}</span>
          <span className="bomb-banner-detail">{detail}</span>
          <span className="bomb-banner-more">
            See the full history
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </span>
        {periods.length > 1 && (
          <ReviewHistoryChart periods={periods} spans={spans} unit={unit} title={title} compact />
        )}
      </DialogTrigger>
      <DialogBackdrop className="bomb-dialog-backdrop" />
      <DialogContent className="bomb-dialog">
        <span className="bomb-dialog-grabber" aria-hidden="true" />
        <header className="bomb-dialog-header">
          <DialogTitle>Review history</DialogTitle>
          <DialogClose className="bomb-dialog-close" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </header>
        <div className="bomb-dialog-body">
          <DialogDescription className="bomb-dialog-lead">
            <strong>{headline}</strong> {detail}
          </DialogDescription>
          {periods.length > 1 && (
            <ReviewHistoryChart periods={periods} spans={spans} unit={unit} title={title} />
          )}
          {periods.length > 0 && (
            <Ledger title={title} spans={spans} periods={periods} cleanScore={cleanScore} />
          )}
          <p className="bomb-dialog-method">
            Counts come from Steam’s review history, which counts reviews differently from Steam’s headline
            score of {steam.pct}% from {count(steam.count)} reviews. Every review posted during
            the {plural(spans)} is left out, positive or negative.{" "}
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${title} review bombing`)}`}
              target="_blank"
              rel="noopener"
            >
              Look up what happened
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LABEL: Record<LedgerRow["kind"], string> = {
  before: "Before",
  bomb: "Review bomb",
  between: "Between",
  since: "After",
};

/** Before, during and after, each as reviews, share positive, and a split bar of the two. */
function Ledger({
  title,
  spans,
  periods,
  cleanScore,
}: {
  title: string;
  spans: BombSpan[];
  periods: ReviewPeriod[];
  cleanScore: number;
}) {
  const rows = reviewLedger(spans, periods);
  const all = periods.reduce((n, p) => ({ up: n.up + p.up, down: n.down + p.down }), { up: 0, down: 0 });
  const kept = rows
    .filter((row) => row.kind !== "bomb")
    .reduce((n, row) => ({ up: n.up + row.up, down: n.down + row.down }), { up: 0, down: 0 });
  return (
    <table className="bomb-ledger">
      <caption>How players rated {title}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Period</th>
          <th scope="col">Reviews</th>
          <th scope="col">Positive</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.start} data-kind={row.kind}>
            <th scope="row">
              <span className="bomb-ledger-cell">
                <span className="bomb-ledger-name">
                  {LABEL[row.kind]} <span>{monthRange(row.start, row.end)}</span>
                </span>
                <Split up={row.up} down={row.down} />
              </span>
            </th>
            <td>{count(row.up + row.down)}</td>
            <td>{share(row.up, row.down)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">
            <span className="bomb-ledger-cell">
              <span className="bomb-ledger-name">All reviews</span>
              <Split up={all.up} down={all.down} />
            </span>
          </th>
          <td>{count(all.up + all.down)}</td>
          <td>{share(all.up, all.down)}%</td>
        </tr>
        <tr data-kind="kept">
          <th scope="row">
            <span className="bomb-ledger-cell">
              <span className="bomb-ledger-name">Without the {plural(spans)}</span>
              <Split up={kept.up} down={kept.down} />
            </span>
          </th>
          <td>{count(kept.up + kept.down)}</td>
          <td>{cleanScore}%</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** One whole split into positive and negative; the figures beside it carry the numbers. */
function Split({ up, down }: { up: number; down: number }) {
  return (
    <span className="bomb-split" aria-hidden="true">
      {up > 0 && <span data-sign="up" style={{ flexGrow: up }} />}
      {down > 0 && <span data-sign="down" style={{ flexGrow: down }} />}
    </span>
  );
}
