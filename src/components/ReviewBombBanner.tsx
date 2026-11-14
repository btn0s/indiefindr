"use client";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
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
          <HistoryChart periods={periods} spans={spans} unit={unit} title={title} compact />
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
            <HistoryChart periods={periods} spans={spans} unit={unit} title={title} />
          )}
          {periods.length > 0 && (
            <Ledger title={title} spans={spans} periods={periods} cleanScore={cleanScore} />
          )}
          <p className="bomb-dialog-method">
            {unit === "month" ? "Monthly" : unit === "week" ? "Weekly" : "Daily"} counts from
            Steam’s review history, which counts reviews differently from Steam’s headline
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

const yearOf = (stamp: number) => new Date(stamp * 1000).getUTCFullYear();
const periodName = (p: ReviewPeriod, unit: string) =>
  unit === "month"
    ? new Date(p.start * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : `${unit === "week" ? "Week of " : ""}${new Date(p.start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

/** The largest of 1, 2 or 5 × 10ⁿ that fits under `peak`. */
function niceTick(peak: number) {
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return [1, 2, 5, 10].filter((n) => n * magnitude <= peak).at(-1)! * magnitude;
}

/**
 * Reviews per period: positive rises above the line, negative hangs below, on one scale.
 * The review bombs are shaded and named. The full chart reads out any period on hover, touch or arrow keys.
 */
function HistoryChart({
  periods,
  spans,
  unit,
  title,
  compact = false,
}: {
  periods: ReviewPeriod[];
  spans: BombSpan[];
  unit: string;
  title: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const low = periods[0].start;
  const high = periods.at(-1)!.end;
  const x = (stamp: number) => ((stamp - low) / (high - low)) * 100;
  const maxUp = Math.max(1, ...periods.map((p) => p.up));
  const maxDown = Math.max(1, ...periods.map((p) => p.down));
  const scale = (n: number) => (n / (maxUp + maxDown)) * 100;
  const baseline = scale(maxUp);
  /** One gridline value for both sides when the quieter side reaches a useful share of the louder one. */
  const shared = niceTick(Math.min(maxUp, maxDown));
  const tick = shared >= Math.max(maxUp, maxDown) / 4 ? shared : niceTick(Math.max(maxUp, maxDown));
  const ticks = [
    ...(maxUp >= tick ? [{ at: baseline - scale(tick), side: "up" }] : []),
    ...(maxDown >= tick ? [{ at: baseline + scale(tick), side: "down" }] : []),
  ];
  const years = Array.from({ length: yearOf(high - 1) - yearOf(low) }, (_, i) => yearOf(low) + 1 + i);
  const range = `${monthRange(low, high)}`;
  const shaded = spans.map((s) => monthRange(s.start, s.end)).join(" and ");

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = low + ((event.clientX - box.left) / box.width) * (high - low);
    const index = periods.findIndex((p) => at < p.end);
    setActive(index < 0 ? periods.length - 1 : index);
  };
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = periods.length - 1;
    const next =
      event.key === "ArrowRight" ? Math.min(last, (active ?? -1) + 1)
      : event.key === "ArrowLeft" ? Math.max(0, (active ?? last + 1) - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };
  const current = active === null ? null : periods[active];

  const marks = (
    <>
      {spans.map((s) => (
        <span
          key={s.start}
          className="history-band"
          style={{ left: `${x(s.start)}%`, width: `${x(s.end) - x(s.start)}%` }}
        />
      ))}
      {!compact &&
        ticks.map((t) => (
          <span key={t.side} className="history-grid" style={{ top: `${t.at}%` }} data-side={t.side}>
            <span>{count(tick)}</span>
          </span>
        ))}
      {periods.map((p, i) => {
        const left = x(p.start);
        const width = x(p.end) - left;
        const place = { left: `${left}cqw`, width: `calc(${width}cqw - clamp(1px, ${width * 0.3}cqw, 2px))` };
        return (
          <span key={p.start} className="history-period" data-active={i === active ? "" : undefined}>
            {p.up > 0 && (
              <span className="history-bar" data-sign="up" style={{ ...place, bottom: `${100 - baseline}%`, height: `max(1px, ${scale(p.up)}%)` }} />
            )}
            {p.down > 0 && (
              <span className="history-bar" data-sign="down" style={{ ...place, top: `${baseline}%`, height: `max(1px, ${scale(p.down)}%)` }} />
            )}
          </span>
        );
      })}
      <span className="history-axis" style={{ top: `${baseline}%` }} />
    </>
  );
  const mids = spans.map((s) => x((s.start + s.end) / 2));
  /** Neighbouring bombs closer than this share of the width are named by year alone. */
  const tight = mids.some((mid, i) => i > 0 && mid - mids[i - 1] < (compact ? 30 : 18)) ? "" : undefined;
  const labels = spans.map((s) => {
    const mid = x((s.start + s.end) / 2);
    return (
      <span key={s.start} style={{ left: `${mid}%` }} data-edge={mid < 12 ? "start" : mid > 88 ? "end" : undefined}>
        <span className="history-label-long">{monthRange(s.start, s.end)}</span>
        <span className="history-label-short">{yearOf(s.start)}</span>
      </span>
    );
  });

  if (compact)
    return (
      <span className="history-chart" data-compact="" aria-hidden="true">
        <span className="history-labels" data-tight={tight}>{labels}</span>
        <span className="history-plot">{marks}</span>
        <span className="history-ends">
          <span>{yearOf(low)}</span>
          <Legend />
          <span>{yearOf(high - 1)}</span>
        </span>
      </span>
    );

  return (
    <figure className="history-chart">
      <figcaption className="history-caption">
        <span className="history-readout" aria-live="polite">
          {current ? (
            <>
              <strong>{periodName(current, unit)}</strong>{" "}
              <span>
                {count(current.up)} positive · {count(current.down)} negative
              </span>
            </>
          ) : (
            <>
              <strong>Reviews per {unit}</strong> <span>{range}</span>
            </>
          )}
        </span>
        <Legend band />
      </figcaption>
      <div className="history-labels" data-tight={tight} aria-hidden="true">{labels}</div>
      <div
        className="history-plot"
        tabIndex={0}
        role="group"
        aria-label={`${title}: positive and negative reviews per ${unit}, ${range}. Shaded: ${shaded}. Arrow keys read each ${unit}.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
        onKeyDown={step}
        onBlur={() => setActive(null)}
        data-active={active === null ? undefined : ""}
      >
        {marks}
      </div>
      <div className="history-years" aria-hidden="true">
        {years.map((year) => {
          const at = x(Date.UTC(year, 0, 1) / 1000);
          return (
            <span
              key={year}
              style={{ left: `${at}%` }}
              data-minor={years.length > 6 && (yearOf(high - 1) - year) % 2 === 1 ? "" : undefined}
              data-end={at > 92 ? "" : undefined}
            >
              {year}
            </span>
          );
        })}
      </div>
    </figure>
  );
}

function Legend({ band = false }: { band?: boolean }) {
  return (
    <span className="history-legend">
      <span data-key="up">Positive</span>
      <span data-key="down">Negative</span>
      {band && <span data-key="band">Review bomb</span>}
    </span>
  );
}
