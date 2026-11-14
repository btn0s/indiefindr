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
  monthRange,
  reviewLedger,
  spanRange,
  type BombSpan,
  type BombStory,
  type LedgerRow,
} from "@/lib/review-quality";
import type { ReviewHistory, ReviewPeriod } from "@/lib/review-history";
import { ReviewHistoryChart } from "@/components/ReviewHistoryChart";

const count = (n: number) => n.toLocaleString("en-US");
const share = (up: number, down: number) => Math.round((100 * up) / (up + down));

/**
 * A game's review-bomb story, in normal flow under its facts: what happened in a sentence, with the
 * review history beside it. Pressing it opens the full history.
 */
export function ReviewBombBanner({
  title,
  story,
  history,
}: {
  title: string;
  story: BombStory;
  history: ReviewHistory | null;
}) {
  const periods = history?.periods ?? [];
  const unit = history?.granularity === "week" ? "week" : history?.granularity === "day" ? "day" : "month";
  const { headline, detail, spans } = story;
  const reasons = spans.filter((s) => s.reason);
  const historyTotal = periods.reduce((n, p) => n + p.up + p.down, 0);
  return (
    <Dialog presentation="auto">
      <DialogTrigger className="bomb-banner" data-kind={story.kind}>
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
          {periods.length > 0 && <Ledger title={title} story={story} periods={periods} />}
          {reasons.length > 0 && (
            <div className="bomb-dialog-reasons">
              <h3>How we judged it</h3>
              {reasons.map((s) => (
                <p key={s.start}>
                  {reasons.length > 1 && <strong>{spanRange(s)}: </strong>}
                  {s.reason}.
                </p>
              ))}
            </div>
          )}
          <p className="bomb-dialog-method">
            {historyTotal > 0 &&
              `The periods count all ${count(historyTotal)} reviews in Steam’s review history. `}
            Steam’s score counts {count(story.steam.count)}: it leaves out reviews from keys bought
            outside Steam and any stretch Steam has already flagged as off-topic. A set-aside window
            leaves out every review in it, positive or negative.{" "}
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

const LABEL: Record<Exclude<LedgerRow["kind"], "bomb">, string> = {
  before: "Before",
  between: "Between",
  since: "After",
};
const bombLabel = (span: BombSpan) => (span.verdict === "unresolved" ? "Possible review bomb" : "Review bomb");

/**
 * Before, during and after from Steam's review history, each as reviews, share positive and a split
 * bar; then Steam's score and the score without the set-aside windows, in the score's own population.
 */
function Ledger({ title, story, periods }: { title: string; story: BombStory; periods: ReviewPeriod[] }) {
  const rows = reviewLedger(story.spans, periods);
  const bombs = story.spans.filter((s) => s.verdict !== "unresolved").length;
  const without =
    story.kind === "possible" ? "Without the possible review bomb"
    : bombs > 1 ? "Without the review bombs"
    : "Without the review bomb";
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
        {rows.map((row) => {
          const span = row.kind === "bomb" ? story.spans.find((s) => s.start === row.start) : undefined;
          return (
            <tr key={row.start} data-kind={row.kind} data-verdict={span?.verdict}>
              <th scope="row">
                <span className="bomb-ledger-cell">
                  <span className="bomb-ledger-name">
                    {span ? bombLabel(span) : LABEL[row.kind as keyof typeof LABEL]}{" "}
                    <span>{span ? spanRange(span) : monthRange(row.start, row.end)}</span>
                  </span>
                  <Split up={row.up} down={row.down} />
                </span>
              </th>
              <td>{count(row.up + row.down)}</td>
              <td>{share(row.up, row.down)}%</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">
            <span className="bomb-ledger-cell">
              <span className="bomb-ledger-name">Steam’s score</span>
              <Split up={story.steam.pct} down={100 - story.steam.pct} />
            </span>
          </th>
          <td>{count(story.steam.count)}</td>
          <td>{story.steam.pct}%</td>
        </tr>
        <tr data-kind="kept">
          <th scope="row">
            <span className="bomb-ledger-cell">
              <span className="bomb-ledger-name">{without}</span>
              <Split up={story.without.pct} down={100 - story.without.pct} />
            </span>
          </th>
          <td>{count(story.without.count)}</td>
          <td>{story.without.pct}%</td>
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
