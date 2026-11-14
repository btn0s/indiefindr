"use client";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/react/collapsible";
import {
  bombSummary,
  monthRange,
  reviewLedger,
  type BombSpan,
  type LedgerRow,
} from "@/lib/review-quality";
import type { ReviewHistory } from "@/lib/review-history";

/** Holds a game's facts and the story of its adjusted score, so the score's note can open the story beneath them. */
export function ReviewStory({ children }: { children: ReactNode }) {
  return <Collapsible className="review-story">{children}</Collapsible>;
}

/** The quiet line under an adjusted score. It opens the story. */
export function ReviewStoryTrigger({ children }: { children: ReactNode }) {
  return (
    <span className="review-story-note">
      <CollapsibleTrigger className="review-story-trigger">
        <span>{children}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </CollapsibleTrigger>
    </span>
  );
}

const LABEL: Record<LedgerRow["kind"], string> = {
  before: "Before",
  bomb: "Review bomb",
  between: "Between",
  since: "After",
};
const count = (n: number) => n.toLocaleString("en-US");
const positive = (up: number, down: number) =>
  `${Math.round((100 * up) / (up + down))}%`;

export function ReviewStoryPanel({
  title,
  steamScore,
  cleanScore,
  spans,
  history,
}: {
  title: string;
  steamScore: number;
  cleanScore: number;
  spans: BombSpan[];
  history: ReviewHistory | null;
}) {
  const periods = history?.periods ?? [];
  const ledger = reviewLedger(spans, periods);
  const kept = ledger.filter((row) => row.kind !== "bomb");
  const keptCount = kept.reduce((n, row) => n + row.up + row.down, 0);
  return (
    <CollapsiblePanel className="review-story-panel">
      <div className="review-story-body">
        <p className="review-story-lead">
          {bombSummary(title, spans)} Steam’s {steamScore}% counts them. Set
          them aside and players rate it {cleanScore}%.
        </p>
        <table className="review-ledger">
          <caption className="sr-only">
            How players rated {title} before, during and after the review
            {spans.length > 1 ? " bombs" : " bomb"}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Period</span>
              </th>
              <th scope="col">Reviews</th>
              <th scope="col">Positive</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.start} data-kind={row.kind}>
                <th scope="row">
                  {LABEL[row.kind]}{" "}
                  <span>{monthRange(row.start, row.end)}</span>
                </th>
                <td>{count(row.up + row.down)}</td>
                <td>{positive(row.up, row.down)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                Adjusted score{" "}
                <span>
                  everything but the {spans.length > 1 ? "bombs" : "bomb"}
                </span>
              </th>
              <td>{keptCount ? count(keptCount) : null}</td>
              <td>{cleanScore}%</td>
            </tr>
          </tfoot>
        </table>
        {periods.length > 0 && (
          <ReviewChart title={title} spans={spans} history={history!} />
        )}
        <p className="review-story-foot">
          Every review posted during a review bomb is left out, positive or
          negative.{" "}
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
    </CollapsiblePanel>
  );
}

/** Reviews per period, positive above the line and negative below, with the left-out stretches shaded and named. */
function ReviewChart({
  title,
  spans,
  history,
}: {
  title: string;
  spans: BombSpan[];
  history: ReviewHistory;
}) {
  const { periods } = history;
  const unit =
    history.granularity === "week"
      ? "week"
      : history.granularity === "day"
        ? "day"
        : "month";
  const low = periods[0].start;
  const high = periods.at(-1)!.end;
  const x = (stamp: number) => ((stamp - low) / (high - low)) * 100;
  const peak = Math.max(1, ...periods.flatMap((p) => [p.up, p.down]));
  const h = (n: number) => (n / peak) * 48;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const tick =
    [1, 2, 5, 10].filter((n) => n * magnitude <= peak).at(-1)! * magnitude;
  const firstYear = new Date(low * 1000).getUTCFullYear() + 1;
  const lastYear = new Date(high * 1000).getUTCFullYear();
  const years = Array.from(
    { length: Math.max(0, lastYear - firstYear + 1) },
    (_, i) => firstYear + i,
  );
  return (
    <figure className="review-chart">
      <figcaption>
        <span>Reviews per {unit}</span>
        <span className="review-chart-key">
          <span data-key="positive">Positive</span>
          <span data-key="negative">Negative</span>
          <span data-key="left-out">Left out</span>
        </span>
      </figcaption>
      <div className="review-chart-plot">
        {spans.map((s) => (
          <span
            key={s.start}
            className="review-chart-band"
            style={{ left: `${x(s.start)}%`, width: `${x(s.end) - x(s.start)}%` }}
          >
            <span>{monthRange(s.start, s.end)}</span>
            <span>{new Date(s.start * 1000).getUTCFullYear()}</span>
          </span>
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: reviews per ${unit} from ${monthRange(low, high)}. Shaded: ${spans.map((s) => monthRange(s.start, s.end)).join(", ")}, left out of the adjusted score.`}
        >
          {[50 - h(tick), 50 + h(tick)].map((y) => (
            <line key={y} x1={0} x2={100} y1={y} y2={y} className="review-chart-grid" />
          ))}
          {periods.map((p) => {
            const left = x(p.start);
            const width = (x(p.end) - left) * 0.78;
            return (
              <g key={p.start}>
                <rect x={left} y={50 - h(p.up)} width={width} height={h(p.up)} className="review-chart-up" />
                <rect x={left} y={50} width={width} height={h(p.down)} className="review-chart-down" />
              </g>
            );
          })}
          <line x1={0} x2={100} y1={50} y2={50} className="review-chart-axis" />
        </svg>
        <span className="review-chart-tick" style={{ top: `${50 - h(tick)}%` }}>
          {count(tick)}
        </span>
        <span className="review-chart-tick" style={{ top: `${50 + h(tick)}%` }}>
          {count(tick)}
        </span>
      </div>
      <div className="review-chart-years" aria-hidden="true">
        {years.map((year) => (
          <span
            key={year}
            style={{ left: `${x(Date.UTC(year, 0, 1) / 1000)}%` }}
            data-minor={years.length > 7 && (lastYear - year) % 2 === 1 ? "" : undefined}
            data-end={x(Date.UTC(year, 0, 1) / 1000) > 88 ? "" : undefined}
          >
            {year}
          </span>
        ))}
      </div>
    </figure>
  );
}
