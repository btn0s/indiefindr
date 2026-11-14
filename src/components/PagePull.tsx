"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cardToReturnTo, setCloseDuration } from "@/lib/card-morph";
import { SwordMark } from "@/components/SwordMark";

const DISMISS = 110; // px of finger travel that commits a dismissal
const FLICK = 0.6; // px/ms: a quick flick commits a shorter dismissal pull
const CLOSE = 240; // ms, globals.css --duration-close (--duration-m)
const READY = 64; // px the content has to come down for a refresh
const HOLD = 56; // px the content waits at while refreshing

type Phase = "idle" | "pulling" | "ready" | "refreshing" | "done";

/** Phones: pulling down from the top of a page. One gesture, one meaning per page, decided as the finger lands:
 *  - A game page opened from a card dismisses: it scales toward that card, rounding its corners over a dimming page,
 *    like closing an App Store card. Let go past the threshold (or flick) and it goes Back, whose transition picks up from
 *    the dragged page and shrinks it into the card (card-morph.ts, globals.css); short of it, it springs back.
 *  - Every other page refreshes, in place of Safari's own pull-to-refresh (switched off with overscroll-behavior): the
 *    content comes down on a rubber band under the header; the sword, resting blade-left, fades in and turns to the logo's
 *    angle with the pull, makes one turn back on release (more while router.refresh() is still running), and fades out.
 *  Nothing starts while a dialog is open, inside a scrolled inner scroller, or on a sideways drag (the screenshot strip). */
export function PagePull() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const sword = useRef<HTMLDivElement>(null);
  // The touch handlers read the phase as they run, so it's kept in a ref alongside the state that renders it.
  const phaseRef = useRef<Phase>("idle");
  const go = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    let mode: "dismiss" | "refresh" | null = null;
    let main: HTMLElement | null = null;
    let start = { x: 0, y: 0 };
    let decided = false;
    let distance = 0;
    let last = { y: 0, t: 0 };
    let velocity = 0; // px/ms, smoothed over the last few moves

    const blocked = (target: EventTarget | null) => {
      if (scrollY > 0 || document.querySelector('dialog[open], [aria-modal="true"], .site-search[data-open=true]')) return true;
      // A drag inside a scroller that is itself scrolled down belongs to it.
      for (let node = target instanceof Element ? target : null; node && node !== document.body; node = node.parentElement) {
        if (node.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return true;
      }
      return false;
    };
    // Rubber band: follows the finger at first, then resists.
    const band = (pull: number, reach: number) => reach * (1 - 1 / (1 + pull / reach));

    const onStart = (event: TouchEvent) => {
      mode = null;
      if (event.touches.length !== 1 || phaseRef.current === "refreshing" || blocked(event.target)) return;
      main = [...document.querySelectorAll<HTMLElement>("main")].find(element => element.checkVisibility()) ?? null;
      if (!main) return;
      mode = main.querySelector(":scope > .page-sheet") && cardToReturnTo() ? "dismiss" : "refresh";
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      last = { y: touch.clientY, t: event.timeStamp };
      decided = false;
      distance = 0;
      velocity = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (!mode || !main) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (!decided) {
        // Up or sideways is a scroll or the screenshot strip, not a pull.
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (dy <= 0 || Math.abs(dx) > dy) { mode = null; return; }
        decided = true;
        if (mode === "dismiss") {
          const box = main.getBoundingClientRect();
          const card = cardToReturnTo()?.center;
          root.style.setProperty("--pull-origin", card ? `${Math.round(card.x - box.left)}px ${Math.round(card.y - box.top)}px` : "50% 30%");
          root.setAttribute("data-pulling", "");
        } else {
          const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
          root.style.setProperty("--refresh-top", `${Math.round(header)}px`);
          go("pulling");
        }
      }
      event.preventDefault();
      if (touch.clientY > last.y || event.timeStamp > last.t) {
        if (event.timeStamp > last.t) velocity = .7 * ((touch.clientY - last.y) / (event.timeStamp - last.t)) + .3 * velocity;
        last = { y: touch.clientY, t: event.timeStamp };
      }
      distance = Math.max(0, dy);
      if (mode === "dismiss") {
        root.style.setProperty("--pull", (1 - 1 / (1 + distance / 320)).toFixed(4));
        root.style.setProperty("--pull-y", `${Math.round(distance * 0.3)}px`);
        return;
      }
      const offset = band(distance, 150);
      root.style.setProperty("--refresh-y", `${offset.toFixed(1)}px`);
      root.style.setProperty("--refresh-progress", Math.min(1, offset / READY).toFixed(3));
      const ready = offset >= READY;
      if (ready !== (phaseRef.current === "ready")) go(ready ? "ready" : "pulling");
    };

    const onEnd = (event: TouchEvent) => {
      if (!mode || !decided || !main) { mode = null; return; }
      const ending = mode;
      mode = null;
      if (ending === "dismiss") {
        // A finger that stopped before lifting has no speed left to hand over.
        const speed = event.timeStamp - last.t < 80 ? Math.max(0, velocity) : 0;
        if (distance > DISMISS || speed > FLICK) {
          // The close spring picks up the finger's speed: a flick closes faster than a slow release.
          setCloseDuration(Math.min(CLOSE, Math.max(160, CLOSE / (1 + speed * .8))));
          history.back();
          // The close captures the dragged page as it starts; once it has run, the drag's styles go.
          const settle = (end: AnimationEvent) => {
            if (end.pseudoElement !== "::view-transition") return;
            document.removeEventListener("animationend", settle);
            root.removeAttribute("data-pulling");
            for (const name of ["--pull", "--pull-y", "--pull-origin"]) root.style.removeProperty(name);
          };
          document.addEventListener("animationend", settle);
          return;
        }
        root.setAttribute("data-pulling", "release");
        root.style.setProperty("--pull", "0");
        root.style.setProperty("--pull-y", "0px");
        main.addEventListener("transitionend", () => {
          root.removeAttribute("data-pulling");
          for (const name of ["--pull", "--pull-y", "--pull-origin"]) root.style.removeProperty(name);
        }, { once: true });
        return;
      }
      if (phaseRef.current === "ready") {
        root.style.setProperty("--refresh-y", `${HOLD}px`);
        go("refreshing");
        startRefresh(() => router.refresh());
      } else {
        root.style.setProperty("--refresh-y", "0px");
        root.style.setProperty("--refresh-progress", "0");
        go("done");
      }
    };

    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: false });
    addEventListener("touchend", onEnd);
    addEventListener("touchcancel", onEnd);
    return () => {
      removeEventListener("touchstart", onStart);
      removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd);
      removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // The refresh has really finished (the transition settled): the sword finishes its turn, then fades as the content returns.
  useEffect(() => {
    if (phase !== "refreshing" || refreshing) return;
    const finish = () => {
      document.documentElement.style.setProperty("--refresh-y", "0px");
      go("done");
    };
    const element = sword.current;
    if (!element || !element.getAnimations().length) { finish(); return; }
    element.addEventListener("animationiteration", finish, { once: true });
    return () => element.removeEventListener("animationiteration", finish);
  }, [phase, refreshing]);

  // Tucked away: once the content and the sword have settled (or straight away if there was nothing to animate), the
  // pull's styles go, so the page carries no transform at rest.
  useEffect(() => {
    if (phase !== "done") return;
    let live = true;
    const frame = requestAnimationFrame(() => {
      const moving = [document.getElementById("content"), sword.current?.parentElement]
        .flatMap(element => element?.getAnimations() ?? []);
      void Promise.allSettled(moving.map(animation => animation.finished)).then(() => {
        if (!live) return;
        for (const name of ["--refresh-y", "--refresh-progress", "--refresh-top"]) document.documentElement.style.removeProperty(name);
        go("idle");
      });
    });
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [phase]);

  return <div className="page-pull" data-phase={phase} aria-hidden>
    <div ref={sword} className="page-pull-sword"><SwordMark bare /></div>
  </div>;
}
