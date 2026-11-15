"use client";
import Image from "next/image";
import { useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { smallCopy } from "@/lib/hero";

type Feel = { duration: number; bounce: number };
function feel(from: Element, token: string): Feel {
  const [duration, bounce] = getComputedStyle(from).getPropertyValue(token).trim().split(/\s+/).map(Number);
  return { duration, bounce };
}
const GAP = 24;
const RECEDE = 0.04;
const SHRINK = 0.5;
const PROJECT = 0.998 / (1 - 0.998);
const STEP = 1 / 120;

type Spring = { x: number; v: number; to: number; k: number; c: number };
const spring = (x = 0): Spring => ({ x, v: 0, to: x, k: 0, c: 0 });
function aim(s: Spring, to: number, feel: Feel, v?: number) {
  s.to = to;
  s.k = (2 * Math.PI / feel.duration) ** 2;
  s.c = 4 * Math.PI * (1 - feel.bounce) / feel.duration;
  if (v !== undefined) s.v = v;
}
function jump(s: Spring, x: number) { s.x = s.to = x; s.v = 0; }
function advance(s: Spring, dt: number, rest: number, restSpeed = rest * 10) {
  if (s.x === s.to && s.v === 0) return false;
  for (let t = 0; t < dt; t += 1 / 240) {
    const h = Math.min(1 / 240, dt - t);
    s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h;
    s.x += s.v * h;
  }
  if (Math.abs(s.x - s.to) < rest && Math.abs(s.v) < restSpeed) { jump(s, s.to); return false; }
  return true;
}
const rubber = (over: number, size: number) => Math.sign(over) * (1 - 1 / (Math.abs(over) * 0.55 / size + 1)) * size;
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

type Pose = { x: number; y: number; s: number; cx: number; cy: number; r: number };
type Box = { x: number; y: number; w: number; h: number };
type Corner = { x: number; y: number };
const KEYS = ["x", "y", "s", "cx", "cy", "r"] as const;

function shotTransforms(f: Box, p: Pose, corner: Corner, pinned: "x" | "y" | null) {
  const s = p.s, cx = Math.max(0, p.cx), cy = Math.max(0, p.cy), r = Math.max(0, p.r);
  const vw = Math.max(1, f.w * s - 2 * cx), vh = Math.max(1, f.h * s - 2 * cy);
  let ox = 0, oy = 0;
  if (corner.x > 0) {
    const pad = Math.max(0, 1 - r);
    for (let i = 0; i < 3; i++) {
      const rx = corner.x * (vw + 2 * ox) / f.w, ry = corner.y * (vh + 2 * oy) / f.h;
      if (pinned === "y") ox = Math.max(0, rx - r) + pad;
      else if (pinned === "x") oy = Math.max(0, ry - r) + pad;
      else ox = oy = (rx > r ? rx - (r + Math.sqrt(2 * rx * rx - r * r)) / 2 : 0) + pad;
    }
  }
  const sx = (vw + 2 * ox) / f.w, sy = (vh + 2 * oy) / f.h;
  return {
    shot: `translate3d(${p.x + cx - ox}px, ${p.y + cy - oy}px, 0) scale(${sx}, ${sy})`,
    art: `translate3d(${(ox - cx) / sx}px, ${(oy - cy) / sy}px, 0) scale(${s / sx}, ${s / sy})`,
  };
}
type Phase = "opening" | "open" | "dragging" | "closing" | "done";
type Drag = {
  id: number; mouse: boolean; x0: number; y0: number; mode: "none" | "pan" | "dismiss"; moved: boolean;
  base: number; ax: number; ay: number; s0: number; b0: number; samples: { x: number; y: number; t: number }[];
};

export function ScreenshotViewer({ title, screenshots, start, thumbs, strip, onClosed }: {
  title: string; screenshots: string[]; start: number;
  thumbs: RefObject<(HTMLButtonElement | null)[]>; strip: RefObject<HTMLUListElement | null>; onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLDivElement | null)[]>([]);
  const shots = useRef<(HTMLDivElement | null)[]>([]);
  const arts = useRef<(HTMLDivElement | null)[]>([]);
  const status = useRef<HTMLParagraphElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const controls = useRef<{ close(byKeyboard: boolean): void; step(direction: number): void; loaded(index: number, img: HTMLImageElement): void }>(null);
  const [wanted, setWanted] = useState(() => new Set([start - 1, start, start + 1]));
  const closed = useEffectEvent(onClosed);
  const want = useEffectEvent((index: number) => {
    if ([index - 1, index, index + 1].every(i => wanted.has(i))) return;
    setWanted(new Set([...wanted, index - 1, index, index + 1]));
  });
  const n = screenshots.length;

  useLayoutEffect(() => {
    const box = dialog.current!, layer = backdrop.current!, row = track.current!;
    const glide = feel(box, "--spring-glide"), snap = feel(box, "--spring-snap"), letGo = feel(box, "--spring-release");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    const shell = document.querySelector<HTMLElement>(".site-shell");
    const thumbAt = (i: number) => thumbs.current[i];

    let W = 0, H = 0, stride = 0;
    let fits: Box[] = [];
    let current = start;
    let phase: Phase = "opening";
    let drag: Drag | null = null;
    let fallback = false;
    let byKeyboard = false;
    const ready = new Set<number>();
    const trackX = spring(), shade = spring();
    const pose = { x: spring(), y: spring(), s: spring(1), cx: spring(), cy: spring(), r: spring() };
    let land: { t: Spring; from: Pose; shade: number; rest: number; to: (recede: number) => Pose } | null = null;
    let corner: Corner = { x: 0, y: 0 }, pinned: "x" | "y" | null = null;
    let origin = { x: 0, y: 0 };

    const fitPose = (): Pose => { const f = fits[current]; return { x: f.x, y: f.y, s: 1, cx: 0, cy: 0, r: 0 }; };
    const setPose = (to: Pose, feel?: Feel) => {
      for (const key of KEYS) {
        if (feel) aim(pose[key], to[key], feel); else jump(pose[key], to[key]);
      }
    };
    const posed = (): Pose => ({ x: pose.x.x, y: pose.y.x, s: pose.s.x, cx: pose.cx.x, cy: pose.cy.x, r: pose.r.x });
    const pageLeft = () => trackX.x + current * stride;
    const recede = () => reduce || !shell ? 0 : clamp(shade.x, 0, 1);

    const thumbPose = (): ((recede: number) => Pose) | null => {
      const thumb = thumbAt(current);
      if (!thumb) return null;
      const m = thumb.getBoundingClientRect();
      if (!m.width || m.bottom <= 0 || m.top >= H || m.right <= 0 || m.left >= W) return null;
      const k0 = 1 - RECEDE * recede(), f = fits[current];
      const left = origin.x + (m.left - origin.x) / k0, top = origin.y + (m.top - origin.y) / k0;
      const w = m.width / k0, h = m.height / k0, s = Math.max(w / f.w, h / f.h);
      const radius = (parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0) * w / thumb.offsetWidth;
      return (o) => {
        const k = 1 - RECEDE * o;
        return {
          x: origin.x + (left - origin.x) * k - pageLeft() + (w - f.w * s) * k / 2, y: origin.y + (top - origin.y) * k + (h - f.h * s) * k / 2,
          s: s * k, cx: (f.w * s - w) * k / 2, cy: (f.h * s - h) * k / 2, r: radius * k,
        };
      };
    };
    const shrunk = (): Pose => { const f = fits[current]; return { x: f.x + f.w * 0.05, y: f.y + f.h * 0.05, s: 0.9, cx: 0, cy: 0, r: 0 }; };

    const place = (i: number) => {
      const shot = shots.current[i], art = arts.current[i], f = fits[i];
      if (!shot || !art) return;
      shot.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
      shot.style.opacity = shot.style.borderRadius = art.style.transform = "";
    };
    const layout = () => {
      W = box.clientWidth; H = box.clientHeight; stride = W + GAP;
      const padX = fine ? 72 : 0, padY = fine ? 48 : 0;
      fits = screenshots.map((_, i) => {
        const img = thumbAt(i)?.querySelector("img");
        const aspect = img?.naturalWidth ? img.naturalWidth / img.naturalHeight : 16 / 9;
        const w = Math.min(W - 2 * padX, (H - 2 * padY) * aspect), h = w / aspect;
        return { x: (W - w) / 2, y: (H - h) / 2, w, h };
      });
      pages.current.forEach((page, i) => { if (page) page.style.transform = `translate3d(${i * stride}px, 0, 0)`; });
      shots.current.forEach((shot, i) => {
        if (!shot) return;
        shot.style.width = `${fits[i].w}px`;
        shot.style.height = `${fits[i].h}px`;
        if (i !== current) place(i);
      });
    };

    type Look = { track: number; shade: number; pose: Pose };
    type Frame = { row: string; shot: string; art: string; shotOpacity: string; shade: string; shell: string };
    const look = (): Look => ({ track: trackX.x, shade: shade.x, pose: posed() });
    const frameAt = (l: Look): Frame => {
      const o = clamp(l.shade, 0, 1), { shot, art } = shotTransforms(fits[current], l.pose, corner, pinned);
      return {
        row: `translate3d(${l.track}px, 0, 0)`, shot, art, shotOpacity: fallback ? String(o) : "1", shade: String(o),
        shell: `scale(${1 - RECEDE * o})`,
      };
    };
    const paint = (frame: Frame) => {
      row.style.transform = frame.row;
      const shot = shots.current[current], art = arts.current[current];
      if (shot && art) {
        shot.style.transform = frame.shot;
        shot.style.opacity = frame.shotOpacity === "1" ? "" : frame.shotOpacity;
        art.style.transform = frame.art;
      }
      if (reduce) box.style.opacity = frame.shade;
      else {
        layer.style.opacity = frame.shade;
        if (shell) shell.style.transform = frame.shell;
      }
    };
    const setCorner = (to: Corner, axis: "x" | "y" | null) => {
      corner = to; pinned = axis;
      const shot = shots.current[current];
      if (shot) shot.style.borderRadius = to.x > 0 ? `${to.x}px / ${to.y}px` : "";
    };

    const reveal = (i: number) => {
      if (ready.has(i) && (i !== current || phase === "open")) shots.current[i]?.setAttribute("data-shown", "");
    };
    const setPhase = (to: Phase) => {
      phase = to;
      box.dataset.phase = to;
      if (to === "open") reveal(current);
    };

    const keepInStrip = (i: number) => {
      const list = strip.current, item = thumbAt(i)?.parentElement;
      if (!list || !item) return;
      const style = getComputedStyle(list);
      const padL = parseFloat(style.scrollPaddingLeft) || 0, padR = parseFloat(style.scrollPaddingRight) || 0;
      const left = item.offsetLeft, right = left + item.offsetWidth;
      if (left < list.scrollLeft + padL || right > list.scrollLeft + list.clientWidth - padR) {
        list.scrollTo({ left: left - padL, behavior: "instant" });
      }
    };

    const show = (i: number) => {
      if (i === current) return;
      place(current);
      thumbAt(current)?.removeAttribute("data-viewing");
      current = i;
      if (!reduce) thumbAt(i)?.setAttribute("data-viewing", "");
      pages.current.forEach((page, j) => page?.toggleAttribute("data-current", j === i));
      setPose(fitPose());
      reveal(i);
      keepInStrip(i);
      want(i);
      if (status.current) status.current.textContent = `${i + 1} of ${n}`;
      prev.current?.setAttribute("aria-disabled", String(i === 0));
      next.current?.setAttribute("aria-disabled", String(i === n - 1));
    };

    const physics = (dt: number) => {
      let moving = false;
      if (land) {
        moving = advance(land.t, dt, land.rest, land.rest * 30);
        const t = Math.min(1, land.t.x), o = land.shade * (1 - t), to = land.to(o), from = land.from;
        for (const key of KEYS) jump(pose[key], from[key] + (to[key] - from[key]) * t);
        jump(shade, o);
      }
      moving = advance(trackX, dt, 0.25) || moving;
      moving = advance(shade, dt, 0.002) || moving;
      for (const key of ["x", "y", "cx", "cy", "r"] as const) moving = advance(pose[key], dt, 0.25) || moving;
      moving = advance(pose.s, dt, 0.0005) || moving;
      return moving;
    };
    const opened = () => {
      const f = fits[current];
      return Math.abs(shade.x - 1) < 0.02 && Math.abs(pose.s.x - 1) < 0.01 && Math.abs(pose.x.x - f.x) < 2 && Math.abs(pose.y.x - f.y) < 2;
    };

    type Flight = { springs: [Spring, Spring][]; steps: number; anims: Animation[]; timers: number[] };
    let flight: Flight | null = null;
    const springs = () => [trackX, shade, ...KEYS.map(key => pose[key]), ...(land ? [land.t] : [])];

    const sync = () => {
      const f = flight;
      if (!f) return;
      flight = null;
      const at = Number(f.anims[0]?.currentTime ?? Infinity) / 1000;
      f.timers.forEach(clearTimeout);
      f.anims.forEach(anim => anim.cancel());
      if (at < f.steps * STEP) {
        for (const [live, was] of f.springs) Object.assign(live, was);
        const whole = Math.floor(at / STEP);
        for (let i = 0; i < whole; i++) physics(STEP);
        physics(at - whole * STEP);
      }
      paint(frameAt(look()));
    };

    const fly = () => {
      if (flight) { flight.timers.forEach(clearTimeout); flight.anims.forEach(anim => anim.cancel()); flight = null; }
      const began: [Spring, Spring][] = springs().map(live => [live, { ...live }]);
      const looks = [look()];
      let openAt = phase === "opening" && opened() ? 0 : -1;
      for (let moving = true; moving && looks.length < 4 / STEP;) {
        moving = physics(STEP);
        looks.push(look());
        if (openAt < 0 && phase === "opening" && opened()) openAt = (looks.length - 1) * STEP;
      }
      const f = fits[current];
      const to: Corner = { x: 0, y: 0 };
      let cropX = 0, cropY = 0;
      for (const { pose: p } of looks) {
        const r = Math.max(0, p.r), cx = Math.max(0, p.cx), cy = Math.max(0, p.cy);
        to.x = Math.max(to.x, r * f.w / Math.max(1, f.w * p.s - 2 * cx));
        to.y = Math.max(to.y, r * f.h / Math.max(1, f.h * p.s - 2 * cy));
        cropX = Math.max(cropX, cx); cropY = Math.max(cropY, cy);
      }
      setCorner(to, cropX > 1 ? "x" : cropY > 1 ? "y" : null);
      const frames = looks.map(frameAt);
      paint(frames[frames.length - 1]);

      const anims: Animation[] = [], timers: number[] = [];
      const duration = (frames.length - 1) * STEP * 1000;
      const run = (el: HTMLElement | null | undefined, values: Partial<Record<"transform" | "opacity", string[]>>) => {
        const moving = Object.entries(values).filter(([, list]) => list.some(v => v !== list[0]));
        if (!el || !moving.length || frames.length < 2) return;
        anims.push(el.animate(frames.map((_, i) => Object.fromEntries(moving.map(([prop, list]) => [prop, list[i]]))), { duration, easing: "linear" }));
      };
      run(row, { transform: frames.map(fr => fr.row) });
      run(shots.current[current], { transform: frames.map(fr => fr.shot), opacity: frames.map(fr => fr.shotOpacity) });
      run(arts.current[current], { transform: frames.map(fr => fr.art) });
      if (reduce) run(box, { opacity: frames.map(fr => fr.shade) });
      else {
        run(layer, { opacity: frames.map(fr => fr.shade) });
        run(shell, { transform: frames.map(fr => fr.shell) });
      }
      const self: Flight = { springs: began, steps: frames.length - 1, anims, timers };
      flight = self;

      if (openAt >= 0) {
        const opens = () => { fallback = false; setPhase("open"); };
        if (openAt === 0) opens(); else timers.push(window.setTimeout(opens, openAt * 1000));
      }
      const landed = () => {
        if (flight !== self) return;
        flight = null;
        if (phase === "closing") return finish();
        setCorner({ x: 0, y: 0 }, null);
        paint(frameAt(look()));
      };
      if (!anims.length) landed();
      else Promise.all(anims.map(anim => anim.finished)).then(landed, () => {});
    };

    let frame = 0, last = 0;
    const kick = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const moving = physics(dt);
      paint(frameAt(look()));
      if (moving) kick();
    };
    const stopTick = () => { cancelAnimationFrame(frame); frame = 0; };

    const flyHome = (velocity = { x: 0, y: 0 }) => {
      aim(trackX, -current * stride, snap);
      if (reduce) { aim(shade, 0, snap); fly(); return; }
      const thumb = fallback ? null : thumbPose();
      fallback = !thumb;
      const to = thumb ?? (() => shrunk());
      const from = posed(), aimed = to(recede()), f = fits[current];
      const dx = aimed.x + f.w * aimed.s / 2 - (from.x + f.w * from.s / 2), dy = aimed.y + f.h * aimed.s / 2 - (from.y + f.h * from.s / 2);
      const distance = Math.hypot(dx, dy, f.w * (aimed.s - from.s));
      const v0 = distance > 1 ? clamp((velocity.x * dx + velocity.y * dy) / (dx * dx + dy * dy || 1), 0, 10) : 0;
      land = { t: spring(0), from, shade: shade.x, rest: 1 / Math.max(1, distance), to };
      aim(land.t, 1, snap, v0);
      fly();
    };
    const close = (keyboard = false, velocity = { x: 0, y: 0 }) => {
      byKeyboard = keyboard;
      if (phase === "closing" || phase === "done") return;
      sync();
      stopTick();
      drag = null;
      fallback = false;
      setPhase("closing");
      keepInStrip(current);
      flyHome(velocity);
    };
    const reopen = () => {
      sync();
      land = null;
      setPhase("opening");
      setPose(fitPose(), glide);
      aim(shade, 1, reduce ? snap : glide);
      fly();
    };
    const restore = () => {
      if (flight) { flight.timers.forEach(clearTimeout); flight.anims.forEach(anim => anim.cancel()); flight = null; }
      stopTick();
      thumbs.current.forEach(thumb => thumb?.removeAttribute("data-viewing"));
      if (shell) shell.style.transform = shell.style.transformOrigin = shell.style.willChange = "";
    };
    const finish = () => {
      setPhase("done");
      restore();
      if (box.open) box.close();
      const thumb = thumbAt(current);
      if (thumb && !byKeyboard) {
        thumb.setAttribute("data-quiet-focus", "");
        thumb.addEventListener("blur", () => thumb.removeAttribute("data-quiet-focus"), { once: true });
      }
      thumb?.focus({ preventScroll: true });
      closed();
    };

    const step = (direction: number) => {
      if (phase !== "open") return;
      sync();
      const to = clamp(current + direction, 0, n - 1);
      if (to === current) {
        if (!reduce) aim(trackX, -current * stride, letGo, -direction * 700);
      } else if (reduce) jump(trackX, -to * stride);
      else aim(trackX, -to * stride, snap);
      show(to);
      fly();
    };

    const velocity = (d: Drag, at: number) => {
      const end = d.samples[d.samples.length - 1];
      if (at - end.t > 60) return { x: 0, y: 0 };
      const begin = d.samples.find(p => end.t - p.t <= 100) ?? end;
      const dt = end.t - begin.t;
      return dt > 0 ? { x: (end.x - begin.x) / dt, y: (end.y - begin.y) / dt } : { x: 0, y: 0 };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (drag) { if (event.pointerId !== drag.id) release(event, true); return; }
      if (event.button !== 0 || (event.target as Element).closest("button") || phase === "done") return;
      drag = {
        id: event.pointerId, mouse: event.pointerType === "mouse", x0: event.clientX, y0: event.clientY, mode: "none",
        moved: false, base: 0, ax: 0, ay: 0, s0: 1, b0: 1, samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
      };
      box.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") showPointer();
      if (!drag || event.pointerId !== drag.id) return;
      drag.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
      if (drag.samples.length > 12) drag.samples.shift();
      let dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.mouse) return;
      if (drag.mode === "none") {
        if (!drag.moved) return;
        sync();
        const sideways = Math.abs(dx) > Math.abs(dy);
        drag.x0 = event.clientX; drag.y0 = event.clientY; dx = dy = 0;
        if (phase === "open" && sideways) {
          drag.mode = "pan";
          drag.base = trackX.x;
          jump(trackX, trackX.x);
        } else {
          drag.mode = "dismiss";
          land = null;
          setPhase("dragging");
          fallback = false;
          drag.s0 = pose.s.x; drag.b0 = shade.x;
          drag.ax = (event.clientX - pageLeft() - pose.x.x) / pose.s.x;
          drag.ay = (event.clientY - pose.y.x) / pose.s.x;
          for (const key of ["cx", "cy", "r"] as const) aim(pose[key], 0, letGo);
        }
      }
      if (drag.mode === "pan") {
        const raw = drag.base + dx, min = -(n - 1) * stride;
        jump(trackX, raw > 0 ? rubber(raw, W) : raw < min ? min + rubber(raw - min, W) : raw);
      } else {
        const lift = dy >= 0 ? dy : -rubber(-dy, H);
        const s = drag.s0 * (1 - SHRINK * clamp(dy / H, 0, 1));
        jump(pose.s, s);
        jump(pose.x, event.clientX - pageLeft() - s * drag.ax);
        jump(pose.y, drag.y0 + lift - s * drag.ay);
        jump(shade, drag.b0 * (1 - clamp(dy / (H * 0.45), 0, 1)));
      }
      paint(frameAt(look()));
      kick();
    };
    const release = (event: PointerEvent, cancelled = false) => {
      const d = drag;
      if (!d || (event.pointerId !== d.id && !cancelled)) return;
      drag = null;
      const v = cancelled ? { x: 0, y: 0 } : velocity(d, event.timeStamp);
      if (d.mode === "none") {
        if (!cancelled && !d.moved) { if (phase === "closing") reopen(); else close(); }
        return;
      }
      stopTick();
      if (d.mode === "pan") {
        const page = current;
        const inside = trackX.x <= 0 && trackX.x >= -(n - 1) * stride;
        const to = clamp(Math.round(-(trackX.x + v.x * PROJECT) / stride), Math.max(0, page - 1), Math.min(n - 1, page + 1));
        aim(trackX, -to * stride, glide, inside ? v.x * 1000 : 0);
        show(to);
        fly();
        return;
      }
      const dy = event.clientY - d.y0;
      const vx = v.x * 1000, vy = v.y * 1000;
      if (!cancelled && (v.y > 0.3 || (dy > H * 0.12 && v.y > -0.1))) close(false, { x: vx, y: vy });
      else {
        pose.x.v = vx;
        pose.y.v = vy;
        pose.s.v = dy > 0 ? -d.s0 * SHRINK * vy / H : 0;
        setPhase("opening");
        setPose(fitPose(), letGo);
        aim(shade, 1, letGo);
        fly();
      }
    };
    const onRelease = (event: PointerEvent) => release(event, event.type === "pointercancel");

    let idle = 0;
    const showPointer = () => {
      box.setAttribute("data-pointer", "");
      clearTimeout(idle);
      idle = window.setTimeout(() => box.removeAttribute("data-pointer"), 1800);
    };
    const onCancel = (event: Event) => { event.preventDefault(); close(true); };
    const onNativeClose = () => { if (phase !== "done" && !box.open) { byKeyboard = true; finish(); } };
    const keep = (event: Event) => event.stopPropagation();
    const onResize = () => {
      sync();
      stopTick();
      drag = null;
      layout();
      jump(trackX, -current * stride);
      if (phase === "closing") { flyHome(); return; }
      setPose(fitPose()); jump(shade, 1); setPhase("open");
      setCorner({ x: 0, y: 0 }, null);
      paint(frameAt(look()));
    };

    box.showModal();
    box.focus({ preventScroll: true });
    layout();
    if (!reduce) thumbAt(current)?.setAttribute("data-viewing", "");
    pages.current.forEach((page, j) => page?.toggleAttribute("data-current", j === current));
    prev.current?.setAttribute("aria-disabled", String(current === 0));
    next.current?.setAttribute("aria-disabled", String(current === n - 1));
    if (status.current) status.current.textContent = `${current + 1} of ${n}`;
    jump(trackX, -current * stride);
    if (shell && !reduce) {
      const page = shell.getBoundingClientRect();
      origin = { x: page.left + page.width / 2, y: page.top + scrollY + innerHeight / 2 };
      shell.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      shell.style.willChange = "transform";
    }
    if (reduce) layer.style.opacity = "1";
    const from = reduce ? null : thumbPose();
    fallback = !reduce && !from;
    setPose(from ? from(0) : reduce ? fitPose() : shrunk());
    jump(shade, 0);
    setPhase("opening");
    setPose(fitPose(), glide);
    aim(shade, 1, reduce ? snap : glide);
    fly();

    controls.current = {
      close, step,
      loaded: (i, img) => { img.decode().catch(() => {}).then(() => { ready.add(i); reveal(i); }); },
    };
    box.addEventListener("pointerdown", onPointerDown);
    box.addEventListener("pointermove", onPointerMove);
    box.addEventListener("pointerup", onRelease);
    box.addEventListener("pointercancel", onRelease);
    box.addEventListener("touchstart", keep);
    box.addEventListener("touchmove", keep);
    box.addEventListener("cancel", onCancel);
    box.addEventListener("close", onNativeClose);
    addEventListener("resize", onResize);
    return () => {
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerup", onRelease);
      box.removeEventListener("pointercancel", onRelease);
      box.removeEventListener("touchstart", keep);
      box.removeEventListener("touchmove", keep);
      box.removeEventListener("cancel", onCancel);
      box.removeEventListener("close", onNativeClose);
      removeEventListener("resize", onResize);
      clearTimeout(idle);
      phase = "done";
      restore();
      if (box.open) box.close();
    };
  }, [screenshots, start, n, thumbs, strip]);

  return createPortal(
    <dialog ref={dialog} className="screenshot-viewer" tabIndex={-1} aria-label={`${title} screenshots`}
      onKeyDown={event => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        controls.current?.step(event.key === "ArrowRight" ? 1 : -1);
      }}>
      <div ref={backdrop} className="viewer-backdrop" />
      <div ref={track} className="viewer-track">
        {screenshots.map((src, i) => <div key={src} ref={page => { pages.current[i] = page; }} className="viewer-page">
          <div ref={shot => { shots.current[i] = shot; }} className="viewer-shot">
            <div ref={art => { arts.current[i] = art; }} className="viewer-art">
              <Image src={smallCopy(src)} alt="" fill unoptimized draggable={false} loading={wanted.has(i) ? "eager" : "lazy"} />
              {wanted.has(i) && <Image className="viewer-full" src={src} alt={`${title} screenshot ${i + 1} of ${n}`} fill sizes="100vw"
                draggable={false} onLoad={event => controls.current?.loaded(i, event.currentTarget)} />}
            </div>
          </div>
        </div>)}
      </div>
      <p ref={status} className="sr-only" aria-live="polite" />
      <button type="button" className="viewer-button viewer-close" aria-label="Close" onClick={event => controls.current?.close(event.detail === 0)}>
        <X size={20} />
      </button>
      <button ref={prev} type="button" className="viewer-button viewer-nav viewer-prev" aria-label="Previous screenshot"
        onClick={() => controls.current?.step(-1)}><ChevronLeft size={22} /></button>
      <button ref={next} type="button" className="viewer-button viewer-nav viewer-next" aria-label="Next screenshot"
        onClick={() => controls.current?.step(1)}><ChevronRight size={22} /></button>
    </dialog>,
    document.body,
  );
}
