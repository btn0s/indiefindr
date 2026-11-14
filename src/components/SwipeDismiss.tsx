"use client";
import { useEffect } from "react";
import { getMorph, setCloseDuration } from "@/lib/card-morph";

const THRESHOLD = 110; // px of pull that commits the dismissal
const FLICK = 0.6; // px/ms: a quick flick commits a shorter pull
const CLOSE = 240; // ms, globals.css --duration-close (--duration-m)

/** Phones: pulling the game page down from its top scales it toward the card it opened from, rounding its corners over a
 *  dimming page, like closing an App Store card. Let go past the threshold (or flick) and it goes Back, whose transition
 *  (HistoryTransition, globals.css) picks up from the dragged page and shrinks it into the card; short of it, it springs
 *  back. Only when there is a page of this site to go back to. */
export function SwipeDismiss() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main.discovery-page:has(.source-game)");
    const navigation = (window as Window & { navigation?: { currentEntry: { index: number } | null } }).navigation;
    if (!main || !matchMedia("(pointer: coarse)").matches) return;
    let start: { y: number; t: number } | null = null;
    let pull = 0;
    let last = { y: 0, t: 0 };
    let velocity = 0; // px/ms, smoothed over the last few moves
    const root = document.documentElement;

    const set = (distance: number) => {
      pull = distance;
      // Rubber-banded: follows the finger at first, then resists.
      const progress = 1 - 1 / (1 + distance / 320);
      root.style.setProperty("--pull", progress.toFixed(4));
      root.style.setProperty("--pull-y", `${Math.round(distance * 0.3)}px`);
    };
    const onStart = (event: TouchEvent) => {
      // A modal over the page (the screenshot viewer, a dialog) owns its own drags.
      if (event.touches.length !== 1 || scrollY > 0 || (navigation?.currentEntry?.index ?? 1) < 1
        || document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const touch = event.touches[0];
      start = { y: touch.clientY, t: event.timeStamp };
      last = { y: touch.clientY, t: event.timeStamp };
      velocity = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const distance = event.touches[0].clientY - start.y;
      if (distance <= 0 && !root.hasAttribute("data-pulling")) { start = null; return; }
      event.preventDefault();
      if (!root.hasAttribute("data-pulling")) {
        const box = main.getBoundingClientRect();
        const card = getMorph()?.center;
        root.style.setProperty("--pull-origin", card ? `${Math.round(card.x - box.left)}px ${Math.round(card.y - box.top)}px` : "50% 30%");
        root.setAttribute("data-pulling", "");
      }
      const now = { y: event.touches[0].clientY, t: event.timeStamp };
      if (now.t > last.t) velocity = .7 * ((now.y - last.y) / (now.t - last.t)) + .3 * velocity;
      last = now;
      set(Math.max(0, distance));
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || !root.hasAttribute("data-pulling")) { start = null; return; }
      // A finger that stopped before lifting has no speed left to hand over.
      const speed = event.timeStamp - last.t < 80 ? Math.max(0, velocity) : 0;
      start = null;
      if (pull > THRESHOLD || speed > FLICK) {
        // The close spring picks up the finger's speed: a flick closes faster than a slow release.
        setCloseDuration(Math.min(CLOSE, Math.max(160, CLOSE / (1 + speed * .8))));
        history.back();
        return;
      }
      root.setAttribute("data-pulling", "release");
      set(0);
      main.addEventListener("transitionend", () => root.removeAttribute("data-pulling"), { once: true });
    };
    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: false });
    addEventListener("touchend", onEnd);
    addEventListener("touchcancel", onEnd);
    // Also runs when the router hides this page after Back (Cache Components keeps it mounted): by then the transition
    // has captured the pulled page, so the pull can go.
    return () => {
      removeEventListener("touchstart", onStart);
      removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd);
      removeEventListener("touchcancel", onEnd);
      root.removeAttribute("data-pulling");
      for (const name of ["--pull", "--pull-y", "--pull-origin"]) root.style.removeProperty(name);
    };
  }, []);
  return null;
}
