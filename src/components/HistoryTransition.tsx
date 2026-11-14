"use client";
import { addTransitionType, startTransition, Suspense, useEffect, ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { markLeavingPage } from "./CardLink";
import { onEntryChange as onMorphEntryChange } from "@/lib/card-morph";

/** Lets Back and Forward animate like a card opening and closing.
 *
 *  React renders a transition that starts inside a `popstate` event synchronously, with the sync lane added, so the
 *  browser's scroll restoration sees the new page; a sync commit is never view-transition eligible. The router starts
 *  its traversal inside `popstate`, so Back skipped every <ViewTransition>. This hands the event to the router one task
 *  later instead, outside `popstate`, where the traversal is an ordinary transition, typed by its direction: Back
 *  shrinks a game page into the card it came from, Forward expands it again. The router keeps recent routes mounted
 *  (cacheComponents), so the restored page still has its scroll. */
export function HistoryTransition() {
  useEffect(() => {
    let direction: "card-open" | "card-close" = "card-close";
    const navigation = (window as Window & { navigation?: EventTarget & { currentEntry: { index: number } | null } }).navigation;
    // Fires before `popstate`, with the entry it came from.
    // It also tells card-morph.ts which card and page to name.
    const onEntryChange = (event: Event) => {
      const { from, navigationType } = event as Event & { from?: { index: number }; navigationType?: string };
      const to = navigation?.currentEntry?.index ?? 0;
      direction = to > (from?.index ?? -1) ? "card-open" : "card-close";
      onMorphEntryChange(navigationType ?? "", from?.index ?? -1, to);
    };
    navigation?.addEventListener("currententrychange", onEntryChange);
    const handedOver = new WeakSet<Event>();
    const onPopState = (event: PopStateEvent) => {
      if (handedOver.has(event)) return;
      event.stopImmediatePropagation();
      const type = direction;
      direction = "card-close";
      setTimeout(() => startTransition(() => {
        markLeavingPage();
        addTransitionType(type);
        const again = new PopStateEvent("popstate", { state: event.state });
        handedOver.add(again);
        window.dispatchEvent(again);
      }));
    };
    // Capture: at the window, capturing listeners run before the router's own.
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("popstate", onPopState, true);
      navigation?.removeEventListener("currententrychange", onEntryChange);
    };
  }, []);
  // React starts a view transition only when a <ViewTransition> boundary in the commit animates. The card and page parts
  // are named by a stylesheet (card-morph.ts), not by boundaries, so every card navigation carries this cue: a boundary
  // per route that enters and exits only for card-open and card-close. Its own snapshot is hidden (globals.css).
  // The route is only known at request time, so the cue streams in rather than block prerendering.
  return <Suspense fallback={null}><TransitionCue /></Suspense>;
}

function TransitionCue() {
  const pathname = usePathname();
  return <ViewTransition key={pathname} default="none" enter={CUE} exit={CUE}><span className="card-cue" aria-hidden /></ViewTransition>;
}

const CUE = { "card-open": "card-cue", "card-close": "card-cue", default: "none" };
