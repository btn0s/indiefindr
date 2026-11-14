"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, TriangleAlert, X } from "lucide-react";
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
  const [overflowing, setOverflowing] = useState(false);
  const [plotWidth, setPlotWidth] = useState(960);
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
    if (!open || !scroll.current) return;
    const viewport = scroll.current;
    const update = () => {
      const actualWidth = viewport.firstElementChild?.clientWidth ?? 960;
      setPlotWidth(actualWidth);
      setOverflowing(viewport.scrollWidth > viewport.clientWidth + 1);
      viewport.scrollLeft =
        (focus / 960) * actualWidth - viewport.clientWidth / 2;
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [focus, open]);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const tick =
    [1, 2, 4, 5, 10].filter((n) => n * magnitude <= maximum).at(-1)! *
    magnitude;
  const ticks = [-tick, -tick / 2, 0, tick / 2, tick];
  const years = periods.filter(
    (p, i) =>
      i === 0 ||
      new Date(p.start * 1000).getUTCFullYear() !==
        new Date(periods[i - 1].start * 1000).getUTCFullYear(),
  );
  const yearStride = Math.max(1, Math.ceil(years.length / (plotWidth / 72)));
  const unit =
    history?.granularity === "week"
      ? "week"
      : history?.granularity === "day"
        ? "day"
        : "month";
  if (!isRescued(game)) return null;
  const label = steamRating(game.review_positive_pct, game.review_count);
  const periodText = (p: ReviewPeriod) =>
    `${month(p.start)}: ${tally(p.up, p.down)}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="review-quality-chip"
        aria-label={`${Math.round(game.clean_score!)}% excluding review bomb. Learn about the detected review bombing`}
      >
        <TriangleAlert size={13} aria-hidden="true" />
        <span>
          <strong>{Math.round(game.clean_score!)}%</strong> excluding review
          bomb
        </span>
      </DialogTrigger>
      <DialogBackdrop className="review-dialog-backdrop" />
      <DialogContent
        className="review-dialog"
        initialFocus="content"
        keepMounted
      >
        <header className="review-dialog-header">
          <span className="review-sheet-handle" aria-hidden="true" />
          <div>
            <DialogTitle>Review bombing detected</DialogTitle>
            <p className="review-dialog-game">{game.title}</p>
          </div>
          <DialogClose
            className="review-dialog-x"
            aria-label="Close review details"
          >
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </header>
        <div className="review-dialog-body">
          <div className="review-score-pair">
            <div className="review-score-steam">
              <strong>{Math.round(game.review_positive_pct!)}%</strong>
              <p>
                Steam rating <span>{label}</span>
              </p>
            </div>
            <ArrowRight
              className="review-score-arrow"
              aria-hidden="true"
              size={24}
            />
            <div className="review-score-adjusted">
              <strong>{Math.round(game.clean_score!)}%</strong>
              <p>Excluding the review bomb</p>
            </div>
          </div>
          <figure className="review-history">
            <figcaption>
              <span>Reviews / {unit}</span>
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
                      <rect
                        key={w.start}
                        x={x(w.startTime)}
                        y={8}
                        width={Math.max(2, x(w.endTime) - x(w.startTime))}
                        height={204}
                        className="bomb-band"
                      />
                    ))}
                    {ticks.map((value) => (
                      <line
                        key={value}
                        x1={48}
                        x2={916}
                        y1={128 - y(value)}
                        y2={128 - y(value)}
                        className={
                          value === 0 ? "history-axis" : "history-grid"
                        }
                      />
                    ))}
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
                  </svg>
                  {ticks.map((value) => (
                    <span
                      key={value}
                      className="history-axis-label history-y-label"
                      style={{ top: 128 - y(value) }}
                      aria-hidden="true"
                    >
                      {value === 0
                        ? "0"
                        : `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US")}`}
                    </span>
                  ))}
                  {years
                    .filter((_, i) => i % yearStride === 0)
                    .map((p) => (
                      <span
                        key={p.start}
                        className="history-axis-label history-year"
                        style={{ left: `${(x(p.start) / 960) * 100}%` }}
                        aria-hidden="true"
                      >
                        {new Date(p.start * 1000).getUTCFullYear()}
                      </span>
                    ))}

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
                      >
                        <span>
                          {date(w.start).replace(/, \d{4}/, "")}–
                          {date(w.end).replace(/, \d{4}/, "")}
                        </span>
                        <span>{w.start.slice(0, 4)}</span>
                      </TooltipTrigger>
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
                Detected periods
              </span>
              {overflowing && (
                <span className="review-scroll-hint">
                  Scroll to explore <ArrowRight size={12} aria-hidden="true" />
                </span>
              )}
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
            Search for more about this{" "}
            <ArrowRight
              size={14}
              className="review-external-arrow"
              aria-hidden="true"
            />
          </a>
          <DialogClose className="review-dialog-close">Close</DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
