"use client";
import Image from "next/image";
import { useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Steam serves each screenshot at fixed sizes beside the original; the strip shows the 600px one. */
export const thumbSrc = (src: string) => src.replace(/(\/ss_[0-9a-f]+)\.jpg/, "$1.600x338.jpg");

// Motion. Every moving value is a spring, so any of them can be retargeted mid-flight and keeps its velocity: a tap
// while it opens sends it back, a finger catches it, a release hands the finger's speed to the spring that takes over.
type Feel = { duration: number; bounce: number };
const OPEN: Feel = { duration: 0.44, bounce: 0.08 };
const CLOSE: Feel = { duration: 0.36, bounce: 0 };
const PAGE: Feel = { duration: 0.4, bounce: 0 };
const SETTLE: Feel = { duration: 0.34, bounce: 0.12 }; // back into place after a drag that didn't dismiss
const FADE: Feel = { duration: 0.24, bounce: 0 }; // reduced motion: the viewer only fades
const GAP = 24; // between shots while swiping
const RECEDE = 0.04; // how far the page shrinks back behind the open viewer
const SHRINK = 0.5; // how small a shot gets dragged down a whole screen
const PROJECT = 0.998 / (1 - 0.998); // iOS scroll deceleration: how far a release at 1px/ms would coast, in px

type Spring = { x: number; v: number; to: number; k: number; c: number };
const spring = (x = 0): Spring => ({ x, v: 0, to: x, k: 0, c: 0 });
/** Sends a spring toward `to`, keeping its velocity unless given one (px/s). Stiffness and damping from duration and
 *  bounce, as Motion and SwiftUI define them. */
function aim(s: Spring, to: number, feel: Feel, v?: number) {
  s.to = to;
  s.k = (2 * Math.PI / feel.duration) ** 2;
  s.c = 4 * Math.PI * (1 - feel.bounce) / feel.duration;
  if (v !== undefined) s.v = v;
}
function jump(s: Spring, x: number) { s.x = s.to = x; s.v = 0; }
/** Steps a spring by dt seconds; false once it has settled. */
function advance(s: Spring, dt: number, rest: number) {
  if (s.x === s.to && s.v === 0) return false;
  for (let t = 0; t < dt; t += 1 / 240) {
    const h = Math.min(1 / 240, dt - t);
    s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h;
    s.x += s.v * h;
  }
  if (Math.abs(s.x - s.to) < rest && Math.abs(s.v) < rest * 10) { jump(s, s.to); return false; }
  return true;
}
/** iOS rubber band: follows at first, then resists, never passing `size`. */
const rubber = (over: number, size: number) => Math.sign(over) * (1 - 1 / (Math.abs(over) * 0.55 / size + 1)) * size;
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Where a shot sits: top-left corner in its page (px), uniform scale, and a symmetric crop and corner radius in
 *  screen px. At rest open it is the shot's fitted box at scale 1 with no crop; over its thumbnail, it is scaled to
 *  cover the thumbnail's box and cropped to it. */
type Pose = { x: number; y: number; s: number; cx: number; cy: number; r: number };
type Box = { x: number; y: number; w: number; h: number };
type Phase = "opening" | "open" | "dragging" | "closing" | "done";
type Drag = {
  id: number; mouse: boolean; x0: number; y0: number; mode: "none" | "pan" | "dismiss"; moved: boolean;
  base: number; ax: number; ay: number; s0: number; b0: number; samples: { x: number; y: number; t: number }[];
};

/** The full-screen screenshot viewer. It opens out of the tapped thumbnail and closes back into the thumbnail of the
 *  shot it is showing, wherever the strip has scrolled. Swipe or arrow keys between shots; drag down, tap, click, Esc
 *  or the close button to close. The page behind recedes a little and its scroll is locked. Each shot shows the
 *  strip's already-loaded image at once and crossfades to the full-size one once that has decoded and the shot is at
 *  rest. Reduced motion: it fades in and out in place. Mounted only while open. */
export function ScreenshotViewer({ title, screenshots, start, thumbs, strip, onClosed }: {
  title: string; screenshots: string[]; start: number;
  thumbs: RefObject<(HTMLButtonElement | null)[]>; strip: RefObject<HTMLUListElement | null>; onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLDivElement | null)[]>([]);
  const shots = useRef<(HTMLDivElement | null)[]>([]);
  const status = useRef<HTMLParagraphElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const controls = useRef<{ close(byKeyboard: boolean): void; step(direction: number): void; loaded(index: number, img: HTMLImageElement): void }>(null);
  // Shots whose full-size image is wanted: the one shown and its neighbours, kept once asked for.
  const [wanted, setWanted] = useState(() => new Set([start - 1, start, start + 1]));
  const closed = useEffectEvent(onClosed);
  const want = useEffectEvent((index: number) => {
    if ([index - 1, index, index + 1].every(i => wanted.has(i))) return;
    setWanted(new Set([...wanted, index - 1, index, index + 1]));
  });
  const n = screenshots.length;

  useLayoutEffect(() => {
    const box = dialog.current!, layer = backdrop.current!, row = track.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    const shell = document.querySelector<HTMLElement>(".site-shell");
    const thumbAt = (i: number) => thumbs.current[i];

    let W = 0, H = 0, stride = 0;
    let fits: Box[] = [];
    let current = start;
    let phase: Phase = "opening";
    let drag: Drag | null = null;
    let fallback = false; // closing with the thumbnail off screen: shrink and fade instead
    let byKeyboard = false; // how the viewer was closed, for whether the thumbnail it returns focus to shows a ring
    const ready = new Set<number>();
    const trackX = spring(), shade = spring();
    const pose = { x: spring(), y: spring(), s: spring(1), cx: spring(), cy: spring(), r: spring() };

    const fitPose = (): Pose => { const f = fits[current]; return { x: f.x, y: f.y, s: 1, cx: 0, cy: 0, r: 0 }; };
    const setPose = (to: Pose, feel?: Feel) => {
      for (const key of ["x", "y", "s", "cx", "cy", "r"] as const) {
        if (feel) aim(pose[key], to[key], feel); else jump(pose[key], to[key]);
      }
    };
    const pageLeft = () => trackX.x + current * stride;

    /** The pose that lays the shown shot exactly over its thumbnail as the page draws it now (receded, scrolled). */
    const thumbPose = (): Pose | null => {
      const thumb = thumbAt(current);
      if (!thumb) return null;
      const r = thumb.getBoundingClientRect();
      if (!r.width || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return null;
      const f = fits[current], s = Math.max(r.width / f.w, r.height / f.h);
      return {
        x: r.left - pageLeft() + (r.width - f.w * s) / 2, y: r.top + (r.height - f.h * s) / 2, s,
        cx: (f.w * s - r.width) / 2, cy: (f.h * s - r.height) / 2, r: (parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0) * r.width / thumb.offsetWidth,
      };
    };
    const shrunk = (): Pose => { const f = fits[current]; return { x: f.x + f.w * 0.05, y: f.y + f.h * 0.05, s: 0.9, cx: 0, cy: 0, r: 0 }; };

    const place = (i: number) => {
      const shot = shots.current[i], f = fits[i];
      if (!shot) return;
      shot.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
      shot.style.clipPath = shot.style.opacity = "";
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

    const render = () => {
      row.style.transform = `translate3d(${trackX.x}px, 0, 0)`;
      const shot = shots.current[current];
      if (shot) {
        const s = pose.s.x, cx = Math.max(0, pose.cx.x), cy = Math.max(0, pose.cy.x), r = Math.max(0, pose.r.x);
        shot.style.transform = `translate3d(${pose.x.x}px, ${pose.y.x}px, 0) scale(${s})`;
        shot.style.clipPath = cx + cy + r > 0.01 ? `inset(${cy / s}px ${cx / s}px round ${r / s}px)` : "";
        shot.style.opacity = fallback ? String(clamp(shade.x, 0, 1)) : "";
      }
      const o = clamp(shade.x, 0, 1);
      if (reduce) box.style.opacity = String(o);
      else {
        layer.style.opacity = String(o);
        if (shell) shell.style.transform = `scale(${1 - RECEDE * o})`;
      }
    };

    // The full-size image fades in over the thumbnail-size one once decoded, but never on a shot that is moving.
    const reveal = (i: number) => {
      if (ready.has(i) && (i !== current || phase === "open")) shots.current[i]?.setAttribute("data-shown", "");
    };
    const setPhase = (to: Phase) => {
      phase = to;
      box.dataset.phase = to;
      if (to === "open") reveal(current);
    };

    /** Keeps the shown shot's thumbnail scrolled into the strip, so the page under the viewer is ready to close into. */
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
      if (phase === "closing" && !reduce) aimClose();
      let moving = advance(trackX, dt, 0.25);
      moving = advance(shade, dt, 0.002) || moving;
      for (const key of ["x", "y", "cx", "cy", "r"] as const) moving = advance(pose[key], dt, 0.25) || moving;
      moving = advance(pose.s, dt, 0.0005) || moving;
      render();
      if (phase === "opening") {
        const f = fits[current];
        if (Math.abs(shade.x - 1) < 0.02 && Math.abs(pose.s.x - 1) < 0.01 && Math.abs(pose.x.x - f.x) < 2 && Math.abs(pose.y.x - f.y) < 2) {
          fallback = false;
          setPhase("open");
        }
      }
      if (phase === "closing" && !moving) return finish();
      if (moving) kick();
    };

    const aimClose = () => {
      const to = fallback ? null : thumbPose();
      if (to) setPose(to, CLOSE);
      else { fallback = true; setPose(shrunk(), CLOSE); }
    };
    const close = (keyboard = false) => {
      byKeyboard = keyboard;
      if (phase === "closing" || phase === "done") return;
      drag = null;
      fallback = false;
      setPhase("closing");
      keepInStrip(current);
      aim(trackX, -current * stride, PAGE);
      aim(shade, 0, reduce ? FADE : CLOSE);
      if (!reduce) aimClose();
      kick();
    };
    const reopen = () => {
      setPhase("opening");
      setPose(fitPose(), OPEN);
      aim(shade, 1, reduce ? FADE : OPEN);
      kick();
    };
    const restore = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      thumbs.current.forEach(thumb => thumb?.removeAttribute("data-viewing"));
      if (shell) shell.style.transform = shell.style.transformOrigin = shell.style.willChange = "";
    };
    const finish = () => {
      setPhase("done");
      restore();
      if (box.open) box.close();
      // Focus goes back to the thumbnail. Only a keyboard close shows the focus ring there: after a pointer or touch
      // close the thumbnail carries a marker that hides the ring until focus leaves it.
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
      const to = clamp(current + direction, 0, n - 1);
      if (to === current) {
        // A nudge against the end, so the key visibly did something.
        if (!reduce) aim(trackX, -current * stride, SETTLE, -direction * 700);
      } else if (reduce) jump(trackX, -to * stride);
      else aim(trackX, -to * stride, PAGE);
      show(to);
      render();
      kick();
    };

    // Gestures. A finger that moves past the slop picks an axis: sideways pages through the shots, down (or any way
    // while it is opening or closing) picks the shot up. A mouse never drags; its click closes.
    const velocity = (d: Drag, at: number) => {
      const end = d.samples[d.samples.length - 1];
      if (at - end.t > 60) return { x: 0, y: 0 };
      const begin = d.samples.find(p => end.t - p.t <= 100) ?? end;
      const dt = end.t - begin.t;
      return dt > 0 ? { x: (end.x - begin.x) / dt, y: (end.y - begin.y) / dt } : { x: 0, y: 0 };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (drag) { if (event.pointerId !== drag.id) release(event, true); return; } // a second finger: no pinch, settle
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
        const sideways = Math.abs(dx) > Math.abs(dy);
        // Start from here, so the shot doesn't jump by the slop.
        drag.x0 = event.clientX; drag.y0 = event.clientY; dx = dy = 0;
        if (phase === "open" && sideways) {
          drag.mode = "pan";
          drag.base = trackX.x;
          jump(trackX, trackX.x);
        } else {
          drag.mode = "dismiss";
          setPhase("dragging");
          fallback = false;
          drag.s0 = pose.s.x; drag.b0 = shade.x;
          drag.ax = (event.clientX - pageLeft() - pose.x.x) / pose.s.x;
          drag.ay = (event.clientY - pose.y.x) / pose.s.x;
          for (const key of ["cx", "cy", "r"] as const) aim(pose[key], 0, SETTLE);
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
      render();
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
      if (d.mode === "pan") {
        // At most one shot from the one it was headed to, so quick repeated swipes each count.
        const page = current;
        const inside = trackX.x <= 0 && trackX.x >= -(n - 1) * stride;
        const to = clamp(Math.round(-(trackX.x + v.x * PROJECT) / stride), Math.max(0, page - 1), Math.min(n - 1, page + 1));
        aim(trackX, -to * stride, PAGE, inside ? v.x * 1000 : 0);
        show(to);
        kick();
        return;
      }
      const dy = event.clientY - d.y0;
      const vx = v.x * 1000, vy = v.y * 1000;
      pose.x.v = vx;
      pose.y.v = vy;
      pose.s.v = dy > 0 ? -d.s0 * SHRINK * vy / H : 0;
      if (!cancelled && (v.y > 0.3 || (dy > H * 0.12 && v.y > -0.1))) close();
      else {
        setPhase("opening");
        setPose(fitPose(), SETTLE);
        aim(shade, 1, SETTLE);
        kick();
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
    // Closed by the browser (a second Esc) rather than by us. A close event can also arrive late, after the dialog was
    // shown again; that one is stale.
    const onNativeClose = () => { if (phase !== "done" && !box.open) { byKeyboard = true; finish(); } };
    // The game page's own pull-down-to-go-back listens on window; a drag in here is the viewer's.
    const keep = (event: Event) => event.stopPropagation();
    const onResize = () => {
      drag = null;
      layout();
      jump(trackX, -current * stride);
      if (phase !== "closing") { setPose(fitPose()); jump(shade, 1); setPhase("open"); }
      render();
    };

    // Open: lay the shot over its thumbnail, hide the thumbnail, and spring both into place, all before first paint.
    box.showModal();
    // Focus the viewer itself rather than its first button, so opening by touch or mouse draws no ring on the close
    // button; Tab still reaches it.
    box.focus({ preventScroll: true });
    layout();
    // The shot lifts out of the strip, leaving its slot empty; with reduced motion it only fades, so the slot stays.
    if (!reduce) thumbAt(current)?.setAttribute("data-viewing", "");
    pages.current.forEach((page, j) => page?.toggleAttribute("data-current", j === current));
    prev.current?.setAttribute("aria-disabled", String(current === 0));
    next.current?.setAttribute("aria-disabled", String(current === n - 1));
    if (status.current) status.current.textContent = `${current + 1} of ${n}`;
    jump(trackX, -current * stride);
    if (shell && !reduce) {
      shell.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      shell.style.willChange = "transform";
    }
    if (reduce) layer.style.opacity = "1";
    const from = reduce ? null : thumbPose();
    fallback = !reduce && !from;
    setPose(from ?? (reduce ? fitPose() : shrunk()));
    jump(shade, 0);
    setPhase("opening");
    render();
    setPose(fitPose(), OPEN);
    aim(shade, 1, reduce ? FADE : OPEN);
    kick();

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
            <Image src={thumbSrc(src)} alt="" fill unoptimized draggable={false} loading={wanted.has(i) ? "eager" : "lazy"} />
            {wanted.has(i) && <Image className="viewer-full" src={src} alt={`${title} screenshot ${i + 1} of ${n}`} fill sizes="100vw"
              draggable={false} onLoad={event => controls.current?.loaded(i, event.currentTarget)} />}
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
