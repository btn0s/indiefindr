import type { ReviewPeriod } from "@/lib/review-history";
import { monthRange, type BombSpan } from "@/lib/review-quality";

/** One bar's worth of reviews: a month, quarter or year, or Steam's own week or day. */
export type Slot = { start: number; end: number; up: number; down: number };
export type Grain = "month" | "quarter" | "year" | "week" | "day";

const date = (stamp: number) => new Date(stamp * 1000);

/** Steam leaves out months with no reviews; the chart needs every month to keep time even. */
function everyMonth(periods: ReviewPeriod[]): Slot[] {
  const byStart = new Map(periods.map((p) => [p.start, p]));
  const first = date(periods[0].start);
  const last = periods.at(-1)!.start;
  const slots: Slot[] = [];
  for (let m = first.getUTCMonth(); ; m++) {
    const start = Date.UTC(first.getUTCFullYear(), m, 1) / 1000;
    if (start > last) return slots;
    slots.push(byStart.get(start) ?? { start, end: Date.UTC(first.getUTCFullYear(), m + 1, 1) / 1000, up: 0, down: 0 });
  }
}

function merge(slots: Slot[], key: (start: number) => number): Slot[] {
  const merged: Slot[] = [];
  for (const s of slots) {
    const open = merged.at(-1);
    if (open && key(open.start) === key(s.start)) Object.assign(open, { end: s.end, up: open.up + s.up, down: open.down + s.down });
    else merged.push({ ...s });
  }
  return merged;
}

/**
 * The finest grain that leaves every bar at least `minSlot` pixels of room, so no bar is a hairline:
 * months, then quarters, then years. Before the plot is measured it stays monthly. Weekly and daily
 * histories are drawn as Steam gives them.
 */
export function slotsFor(periods: ReviewPeriod[], unit: string, width: number, minSlot = 4): { slots: Slot[]; grain: Grain } {
  if (unit !== "month") return { slots: periods, grain: unit === "week" ? "week" : "day" };
  const months = everyMonth(periods);
  if (!width || width / months.length >= minSlot) return { slots: months, grain: "month" };
  const quarters = merge(months, (s) => date(s).getUTCFullYear() * 4 + Math.floor(date(s).getUTCMonth() / 3));
  if (width / quarters.length >= minSlot) return { slots: quarters, grain: "quarter" };
  return { slots: merge(months, (s) => date(s).getUTCFullYear()), grain: "year" };
}

export function slotName(slot: Slot, grain: Grain) {
  if (grain === "month") return date(slot.start).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  if (grain === "quarter") return monthRange(slot.start, slot.end);
  if (grain === "year") return String(date(slot.start).getUTCFullYear());
  const day = date(slot.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return grain === "week" ? `Week of ${day}` : day;
}

export type Bar = { x: number; w: number; up: number; down: number };
/** The smallest bar worth drawing, in pixels. Anything quieter is left to the baseline. */
const VISIBLE = 1.5;

/**
 * Bars snapped to whole pixels: every gap is the same width and no edge is blurred. Positive rises
 * from the baseline, negative hangs below it, both on one scale that fills `height`.
 */
export function layoutBars(slots: Slot[], width: number, height: number) {
  const maxUp = Math.max(1, ...slots.map((s) => s.up));
  const maxDown = Math.max(1, ...slots.map((s) => s.down));
  const perReview = height / (maxUp + maxDown);
  const baseline = Math.round(maxUp * perReview);
  const step = width / slots.length;
  const gap = step >= 6 ? 2 : 1;
  const px = (n: number) => (n * perReview < VISIBLE ? 0 : Math.max(2, Math.round(n * perReview)));
  const bars: Bar[] = slots.map((s, i) => {
    const x = Math.round(i * step);
    return { x, w: Math.max(1, Math.round((i + 1) * step) - x - gap), up: px(s.up), down: px(s.down) };
  });
  return { bars, baseline, perReview, maxUp, maxDown, gap };
}

/** The bars a review bomb's reviews fall in, as a pixel range. */
export function bandFor(span: BombSpan, slots: Slot[], bars: Bar[]) {
  const first = slots.findIndex((s) => s.end > span.start);
  const last = slots.findLastIndex((s) => s.start < span.end);
  if (first < 0 || last < first) return null;
  return { x: bars[first].x, end: bars[last].x + bars[last].w };
}

/** The largest of 1, 2 or 5 × 10ⁿ that fits under `peak`. */
export function niceTick(peak: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, peak)));
  return [1, 2, 5, 10].filter((n) => n * magnitude <= peak).at(-1)! * magnitude;
}

/**
 * Year labels at each January, thinned to every 2nd or 5th year when they would crowd, and dropped
 * where they would run off the right edge. The partial first year is named at the left edge when there's room.
 */
export function yearTicks(slots: Slot[], bars: Bar[], width: number, labelWidth = 40) {
  const januaries = slots.flatMap((s, i) => (date(s.start).getUTCMonth() === 0 ? [{ year: date(s.start).getUTCFullYear(), x: bars[i].x }] : []));
  const perYear = januaries.length > 1 ? januaries[1].x - januaries[0].x : width;
  const every = [1, 2, 5, 10].find((n) => n * perYear >= labelWidth + 12) ?? 10;
  const ticks = januaries.filter((t, i) => i % every === 0 && t.x + labelWidth <= width);
  const startYear = date(slots[0].start).getUTCFullYear();
  if (date(slots[0].start).getUTCMonth() !== 0 && (ticks[0]?.x ?? width) >= labelWidth + 12)
    ticks.unshift({ year: startYear, x: 0 });
  return ticks;
}

export type Placement = { left: number; row: number };
/**
 * Places labels above the bars they name, each over its own leader line. Rows count up from the
 * plot. A valid layout keeps labels in a row apart and never runs a leader through a label below it;
 * of those, the one with the fewest, lowest rows wins. Returns null when no layout fits `maxRows`.
 */
export function placeCallouts(items: { anchor: number; width: number }[], width: number, maxRows: number, pad = 16): Placement[] | null {
  if (!items.length) return [];
  if (items.length > 5) return null;
  const options = items.map(({ anchor, width: w }) => {
    const clamp = (left: number) => Math.min(Math.max(0, left), Math.max(0, width - w));
    const sides = [anchor, anchor - w, anchor - w / 2].map((ideal, side) => {
      const left = clamp(ideal);
      return { left, cost: (side === 2 ? 3 : 0) + (Math.abs(left - ideal) > 1 ? 1 : 0) };
    });
    return Array.from({ length: maxRows }, (_, row) => sides.map((s) => ({ ...s, row }))).flat();
  });
  let best: { cost: number; pick: Placement[] } | null = null;
  const walk = (i: number, pick: (Placement & { cost: number })[]) => {
    if (i === items.length) {
      const top = Math.max(...pick.map((p) => p.row));
      const cost = top * 100 + pick.reduce((n, p) => n + p.row * 10 + p.cost, 0);
      if (!best || cost < best.cost) best = { cost, pick: pick.map(({ left, row }) => ({ left, row })) };
      return;
    }
    const fits = (p: Placement, j: number) => {
      const a = { from: p.left, to: p.left + items[i].width, anchor: items[i].anchor };
      const b = { from: pick[j].left, to: pick[j].left + items[j].width, anchor: items[j].anchor };
      if (p.row === pick[j].row) return a.to + pad <= b.from || b.to + pad <= a.from;
      const [upper, lower] = p.row > pick[j].row ? [a, b] : [b, a];
      return upper.anchor < lower.from - pad / 2 || upper.anchor > lower.to + pad / 2;
    };
    for (const option of options[i]) if (pick.every((_, j) => fits(option, j))) walk(i + 1, [...pick, option]);
  };
  walk(0, []);
  return (best as { pick: Placement[] } | null)?.pick ?? null;
}
