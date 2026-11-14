"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import {
  bombWindows,
  isRescued,
  type ReviewQuality,
} from "@/lib/review-quality";
import { steamRating } from "@/lib/rating";
import type { ReviewHistory, ReviewPeriod } from "@/lib/review-history";
const date = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const percent = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const month = (stamp: number) =>
  new Date(stamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const tally = (up: number, down: number) =>
  `${up.toLocaleString("en-US")} positive / ${down.toLocaleString("en-US")} negative / ${up + down ? percent((100 * up) / (up + down)) : 0}% positive`;
export function ReviewQualityNote({
  game,
  history = null,
}: {
  game: ReviewQuality & {
    title: string;
    review_positive_pct: number | null;
    review_count: number;
  };
  history?: ReviewHistory | null;
}) {
  const [open, setOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const windows = bombWindows(game.bomb_windows).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const periods = history?.periods ?? [];
  const low = periods.length ? Math.min(...periods.map((p) => p.start)) : 0;
  const high = periods.length ? Math.max(...periods.map((p) => p.end)) : 1;
  const span = Math.max(1, high - low);
  const x = (stamp: number) => 48 + ((stamp - low) / span) * 868;
  const maximum = Math.max(1, ...periods.flatMap((p) => [p.up, p.down]));
  const y = (count: number) => (count / maximum) * 76;
  const width = 960;
  const periodWindows = windows.map((w) => ({
    ...w,
    startTime: w.start_ts ?? Date.parse(w.start + "T00:00:00Z") / 1000 + 86400,
    endTime: w.end_ts ?? Date.parse(w.end + "T00:00:00Z") / 1000 + 2 * 86400,
  }));
  const focus = periodWindows.length
    ? (x(periodWindows[0].startTime) +
        x(periodWindows[periodWindows.length - 1].endTime)) /
      2
    : 0;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (scroll.current)
        scroll.current.scrollLeft = focus - scroll.current.clientWidth / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, open]);
  if (!isRescued(game)) return null;
  const label = steamRating(game.review_positive_pct, game.review_count);
  const periodText = (p: ReviewPeriod) =>
    `${month(p.start)}: ${tally(p.up, p.down)}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="review-inline-notice">
        <TriangleAlert size={15} aria-hidden="true" />
        <span className="review-inline-title">Review bombing detected</span>
        <span className="review-inline-score">
          {game.review_positive_pct}% →{" "}
          <strong>{percent(game.clean_score!)}%</strong> without it
        </span>
        <DialogTrigger className="review-learn-button">
          Learn more
        </DialogTrigger>
      </div>
      <DialogBackdrop className="review-dialog-backdrop" />
      <DialogContent
        className="review-dialog"
        initialFocus="content"
        keepMounted
      >
        <header className="review-dialog-header">
          <DialogTitle>Review bombing detected</DialogTitle>
        </header>
        <div className="review-dialog-body">
          <div className="review-score-pair">
            <div className="review-score-steam">
              <div>
                <strong>{game.review_positive_pct}%</strong>
                <span>Steam</span>
              </div>
              <p>{label}</p>
            </div>
            <ArrowRight
              className="review-score-arrow"
              aria-hidden="true"
              size={22}
            />
            <ArrowDown
              className="review-score-arrow-phone"
              aria-hidden="true"
              size={20}
            />
            <div className="review-score-adjusted">
              <div>
                <strong>{percent(game.clean_score!)}%</strong>
                <span>without the bomb</span>
              </div>
              <p>Positive reviews outside the detected periods</p>
            </div>
          </div>
          <figure className="review-history">
            <figcaption>
              <span>
                {history?.granularity === "week"
                  ? "Weekly"
                  : history?.granularity === "day"
                    ? "Daily"
                    : "Monthly"}{" "}
                Steam reviews
              </span>
              <span className="review-history-key">
                <i className="positive-key" />
                Positive <i className="negative-key" />
                Negative
              </span>
            </figcaption>
            {periods.length ? (
              <div
                className="review-history-scroll"
                ref={scroll}
                aria-label="Review history. Scroll horizontally to explore all periods."
              >
                <div className="review-history-plot">
                  <svg
                    viewBox={`0 0 ${width} 252`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {periodWindows.map((w) => (
                      <g key={w.start}>
                        <rect
                          x={x(w.startTime)}
                          y={44}
                          width={Math.max(2, x(w.endTime) - x(w.startTime))}
                          height={164}
                          className="bomb-band"
                        />
                        <line
                          x1={(x(w.startTime) + x(w.endTime)) / 2}
                          x2={(x(w.startTime) + x(w.endTime)) / 2}
                          y1={35}
                          y2={44}
                          className="bomb-band-rule"
                        />
                        <text
                          x={(x(w.startTime) + x(w.endTime)) / 2}
                          y={15}
                          textAnchor="middle"
                          className="bomb-band-label"
                        >
                          <tspan x={(x(w.startTime) + x(w.endTime)) / 2}>
                            {date(w.start).replace(/, \d{4}/, "")}–
                            {date(w.end).replace(/, \d{4}/, "")}
                          </tspan>
                          <tspan
                            x={(x(w.startTime) + x(w.endTime)) / 2}
                            dy={15}
                          >
                            {w.start.slice(0, 4) === w.end.slice(0, 4)
                              ? w.start.slice(0, 4)
                              : `${w.start.slice(0, 4)}–${w.end.slice(0, 4)}`}
                          </tspan>
                        </text>
                      </g>
                    ))}
                    {[52, 90, 128, 166, 204].map((value) => (
                      <line
                        key={value}
                        x1={48}
                        x2={916}
                        y1={value}
                        y2={value}
                        className={
                          value === 128 ? "history-axis" : "history-grid"
                        }
                      />
                    ))}
                    <text
                      x={36}
                      y={55}
                      textAnchor="end"
                      className="history-axis-label"
                    >
                      +
                      {maximum >= 1000
                        ? `${percent(maximum / 1000)}k`
                        : maximum}
                    </text>
                    <text
                      x={36}
                      y={132}
                      textAnchor="end"
                      className="history-axis-label"
                    >
                      0
                    </text>
                    <text
                      x={36}
                      y={207}
                      textAnchor="end"
                      className="history-axis-label"
                    >
                      −
                      {maximum >= 1000
                        ? `${percent(maximum / 1000)}k`
                        : maximum}
                    </text>
                    {periods.map((p) => (
                      <g key={p.start}>
                        <rect
                          x={x(p.start) + 1}
                          y={128 - y(p.up)}
                          width={Math.max(1, x(p.end) - x(p.start) - 2)}
                          height={y(p.up)}
                          className="history-positive"
                        />
                        <rect
                          x={x(p.start) + 1}
                          y={128}
                          width={Math.max(1, x(p.end) - x(p.start) - 2)}
                          height={y(p.down)}
                          className="history-negative"
                        />
                      </g>
                    ))}
                    {periods
                      .filter(
                        (p, i) =>
                          i === 0 ||
                          new Date(p.start * 1000).getUTCFullYear() !==
                            new Date(
                              periods[i - 1].start * 1000,
                            ).getUTCFullYear(),
                      )
                      .map((p) => (
                        <text
                          key={p.start}
                          x={x(p.start)}
                          y={237}
                          className="history-axis-label"
                        >
                          {new Date(p.start * 1000).getUTCFullYear()}
                        </text>
                      ))}
                  </svg>
                  {periods.map((p) => (
                    <Tooltip key={p.start} delay={120} toggleable>
                      <TooltipTrigger
                        className="history-point"
                        style={{
                          left: `${(x(p.start) / width) * 100}%`,
                          width: `${(Math.max(1, x(p.end) - x(p.start)) / width) * 100}%`,
                        }}
                        aria-label={periodText(p)}
                      />
                      <TooltipContent className="review-tooltip" sideOffset={8}>
                        {periodText(p)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {periodWindows.map((w) => (
                    <Tooltip key={w.start} delay={120} toggleable>
                      <TooltipTrigger
                        className="history-window-point"
                        style={{
                          left: `${((x(w.startTime) + x(w.endTime)) / 2 / width) * 100}%`,
                        }}
                        aria-label={`Detected period ${date(w.start)} to ${date(w.end)}: ${tally(w.up, w.down)}`}
                      />
                      <TooltipContent className="review-tooltip" sideOffset={8}>
                        Detected period {date(w.start)} to {date(w.end)}.{" "}
                        {tally(w.up, w.down)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ) : (
              <p className="review-history-unavailable">
                Review history is temporarily unavailable.
              </p>
            )}
            <div className="review-history-caption">
              <span>
                <i />
                Detected periods are shaded
              </span>
              <span>
                Hover or focus for counts{" "}
                <span className="review-scroll-hint">Scroll to explore ↔</span>
              </span>
            </div>
          </figure>
          <DialogDescription className="review-dialog-explanation">
            This game received an unusual surge of negative reviews during{" "}
            {windows.length === 1
              ? "the highlighted period"
              : "the highlighted periods"}
            . Both positive and negative reviews in{" "}
            {windows.length === 1 ? "that period are" : "those periods are"}{" "}
            excluded from the adjusted score.
          </DialogDescription>
        </div>
        <footer className="review-dialog-footer">
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${game.title} review bombing`)}`}
            target="_blank"
            rel="noopener"
          >
            Search for more about this ↗
          </a>
          <DialogClose className="review-dialog-close">Close</DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
