"use client";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { monthRange, spanRange, type BombSpan } from "@/lib/review-quality";
import type { ReviewPeriod } from "@/lib/review-history";
import {
  bandFor,
  layoutBars,
  niceTick,
  placeCallouts,
  slotName,
  slotsFor,
  yearTicks,
  type Placement,
} from "@/lib/review-chart";

const count = (n: number) => n.toLocaleString("en-US");
const yearOf = (stamp: number) => new Date(stamp * 1000).getUTCFullYear();
/** Room above and below the tallest bars, so a shaded review bomb reads as a band around them. */
const INSET = 6;
/** Height of one callout line, and the shortest leader under a callout. */
const LINE = 16;
const LEADER = 10;
/** Below this plot width a callout's numbers drop to a second line. */
const STACK_BELOW = 520;
/** Room a gridline's label takes inside the plot. */
const TICK_LABEL = 104;

/** The plot's size in whole pixels, unaffected by the dialog's opening scale. */
function usePlotSize() {
  const [plot, setPlot] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!plot) return;
    const read = () => setSize({ width: plot.clientWidth, height: plot.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [plot]);
  return [setPlot, size] as const;
}

let canvas: HTMLCanvasElement | null = null;
function textWidth(text: string, style: CSSStyleDeclaration, weight: string) {
  canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  context.font = `${weight} ${style.fontSize} ${style.fontFamily}`;
  return Math.ceil(context.measureText(text).width);
}

/** A rounded data end on the side away from the baseline. */
function barPath(x: number, w: number, baseline: number, h: number, sign: 1 | -1) {
  const r = Math.min(2, w / 2, h);
  const tip = baseline - sign * h;
  const toward = sign * r;
  return `M${x} ${baseline}V${tip + toward}Q${x} ${tip} ${x + r} ${tip}H${x + w - r}Q${x + w} ${tip} ${x + w} ${tip + toward}V${baseline}Z`;
}

/**
 * Reviews over time: positive rises above the line and negative hangs below, on one scale, with each
 * review bomb shaded and named over a leader. Bars snap to whole pixels and widen to quarters or
 * years when months would be hairlines. The full chart reads out any bar on hover, touch or arrow keys;
 * the compact one, in the banner, only names the bombs' dates.
 */
export function ReviewHistoryChart({
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
  const [plotRef, { width, height }] = usePlotSize();
  const calloutRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [layout, setLayout] = useState<{ places: Placement[]; short: boolean } | null>(null);

  const { slots, grain } = slotsFor(periods, unit, width, compact ? 5 : 4);
  const inner = Math.max(1, height - 2 * INSET);
  const { bars, baseline: base, perReview, maxUp, maxDown } = layoutBars(slots, width, inner);
  const baseline = base + INSET;
  const stacked = !compact && width > 0 && width < STACK_BELOW;
  const range = monthRange(periods[0].start, periods.at(-1)!.end);

  const bands = spans.map((s) => (width ? bandFor(s, slots, bars) : null));
  const callouts = spans.map((s) => {
    const dates = spanRange(s);
    const total = s.up + s.down;
    return { dates, year: String(yearOf(s.start)), detail: `${count(total)} reviews, ${Math.round((100 * s.down) / total)}% negative` };
  });

  useLayoutEffect(() => {
    if (!width) return;
    const style = getComputedStyle(calloutRef.current!);
    const anchors = bands.map((b) => (b ? Math.round((b.x + b.end) / 2) : 0));
    const sized = (text: (c: (typeof callouts)[number]) => string[]) =>
      callouts.map((c, i) => {
        const [first, ...rest] = text(c);
        const lines = [textWidth(first, style, "500"), ...rest.map((line) => textWidth(line, style, "400"))];
        return { anchor: anchors[i], width: stacked ? Math.max(...lines) : lines.reduce((a, b) => a + b, 0) };
      });
    if (compact) {
      const places = placeCallouts(sized((c) => [c.dates]), width, 1, 12);
      setLayout(places ? { places, short: false } : { places: placeCallouts(sized((c) => [c.year]), width, 1, 8) ?? [], short: true });
      return;
    }
    const lines = (c: (typeof callouts)[number]) => (stacked ? [c.dates, c.detail] : [c.dates, ` · ${c.detail}`]);
    setLayout({ places: placeCallouts(sized(lines), width, 3) ?? callouts.map((_, i) => ({ left: anchors[i], row: i })), short: false });
    // The callout text and anchors follow from the props and the measured size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, compact, stacked, periods, spans]);

  const rowHeight = (stacked ? 2 : 1) * LINE + 6;
  const rows = compact ? 1 : layout && layout.places.length ? Math.max(...layout.places.map((p) => p.row)) + 1 : 1;
  const calloutHeight = rows * rowHeight + LEADER;

  const tick = niceTick(Math.min(maxUp, maxDown)) >= Math.max(maxUp, maxDown) / 4 ? niceTick(Math.min(maxUp, maxDown)) : niceTick(Math.max(maxUp, maxDown));
  const gridlines = compact || !width ? [] : [
    ...(maxUp >= tick ? [{ y: Math.round(baseline - tick * perReview) + 0.5, side: "positive" }] : []),
    ...(maxDown >= tick ? [{ y: Math.round(baseline + tick * perReview) + 0.5, side: "negative" }] : []),
  ].map((g) => {
    /** A label sits at the left unless a bar would run through it there and not at the right. */
    const reaches = (from: number, to: number) =>
      bars.some((b) => b.x + b.w > from && b.x < to && (g.side === "positive" ? baseline - b.up < g.y - 2 : baseline + b.down > g.y + 2));
    return { ...g, end: reaches(0, TICK_LABEL) && !reaches(width - TICK_LABEL, width) };
  });

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    const index = bars.findLastIndex((b) => b.x <= x);
    setActive(Math.max(0, index));
  };
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = slots.length - 1;
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
  const current = active === null ? null : slots[active];

  const svg = width > 0 && (
    <svg className="history-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bands.map((b, i) => b && <rect key={spans[i].start} className="history-band" data-verdict={spans[i].verdict} x={b.x - 2} width={b.end - b.x + 4} y={0} height={height} rx={3} />)}
      {gridlines.map((g) => <line key={g.side} className="history-grid" x1={0} x2={width} y1={g.y} y2={g.y} />)}
      {bars.map((b, i) => (
        <g key={slots[i].start} className="history-slot" data-active={i === active ? "" : undefined}>
          {b.up > 0 && <path className="history-bar" data-sign="up" d={barPath(b.x, b.w, baseline, b.up, 1)} />}
          {b.down > 0 && <path className="history-bar" data-sign="down" d={barPath(b.x, b.w, baseline, b.down, -1)} />}
        </g>
      ))}
      <rect className="history-axis" x={0} width={width} y={baseline - 0.5} height={1} />
    </svg>
  );

  const calloutLayer = (
    <span ref={calloutRef} className="history-callouts" style={compact ? undefined : { height: calloutHeight }} aria-hidden="true">
      {layout &&
        layout.places.map((place, i) => {
          const band = bands[i];
          if (!band) return null;
          const anchor = Math.round((band.x + band.end) / 2);
          const c = callouts[i];
          const top = compact ? 0 : (rows - 1 - place.row) * rowHeight;
          return (
            <span key={spans[i].start}>
              <span className="history-callout" style={{ left: place.left, top }} data-stacked={stacked ? "" : undefined}>
                {compact ? (layout.short ? c.year : c.dates) : (
                  <>
                    <strong>{c.dates}</strong>
                    <span>{stacked ? c.detail : ` · ${c.detail}`}</span>
                  </>
                )}
              </span>
              {!compact && <span className="history-leader" style={{ left: anchor, top: top + (stacked ? 2 : 1) * LINE + 4 }} />}
            </span>
          );
        })}
    </span>
  );

  if (compact)
    return (
      <span className="history-chart" data-compact="" aria-hidden="true">
        {calloutLayer}
        <span ref={plotRef} className="history-plot">
          {svg}
          {width > 0 && (
            <>
              <span className="history-direct" data-sign="up" style={{ bottom: height - baseline + 3 }}>Positive</span>
              <span className="history-direct" data-sign="down" style={{ top: baseline + 3 }}>Negative</span>
            </>
          )}
        </span>
        <span className="history-ends">
          <span>{yearOf(periods[0].start)}</span>
          <span>{yearOf(periods.at(-1)!.end - 1)}</span>
        </span>
      </span>
    );

  const shaded = spans.map((s) => spanRange(s)).join(" and ");
  const ticks = width ? yearTicks(slots, bars, width) : [];
  return (
    <figure className="history-chart">
      <figcaption className="history-caption">
        <span className="history-readout" aria-live="polite">
          {current ? (
            <>
              <strong>{slotName(current, grain)}</strong>{" "}
              <span>
                {count(current.up)} positive · {count(current.down)} negative
              </span>
            </>
          ) : (
            <>
              <strong>Reviews per {grain}</strong> <span>{range}</span>
            </>
          )}
        </span>
        <span className="history-legend">
          <span data-key="up">Positive</span>
          <span data-key="down">Negative</span>
          {spans.some((s) => s.verdict !== "unresolved") && <span data-key="band">Review bomb</span>}
          {spans.some((s) => s.verdict === "unresolved") && <span data-key="band" data-verdict="unresolved">Possible review bomb</span>}
        </span>
      </figcaption>
      {calloutLayer}
      <div
        ref={plotRef}
        className="history-plot"
        tabIndex={0}
        role="group"
        aria-label={`${title}: positive and negative reviews per ${grain}, ${range}. Shaded: ${shaded}. Arrow keys read each ${grain}.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
        onKeyDown={step}
        onBlur={() => setActive(null)}
        data-active={active === null ? undefined : ""}
      >
        {svg}
        {gridlines.map((g) => (
          <span key={g.side} className="history-tick" data-at={g.end ? "end" : "start"} style={g.side === "positive" ? { bottom: height - g.y + 3 } : { top: g.y + 3 }}>
            {count(tick)} {g.side}
          </span>
        ))}
      </div>
      <div className="history-years" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.year} style={{ left: t.x }}>
            {t.year}
          </span>
        ))}
      </div>
    </figure>
  );
}
