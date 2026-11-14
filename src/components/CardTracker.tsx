"use client";
import { useEffect, useRef } from "react";
import { track } from "@/lib/tracking";

const CARD = "a.game-card[data-appid]";

/** Impressions and clicks for every card in the grid it sits in, cards appended later included: one observer and one
 *  listener per grid rather than one per card. */
export function CardTracker({ pageAppid }: { pageAppid?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const grid = ref.current?.parentElement;
    if (!grid) return;
    const send = (event: "impression" | "click_card", card: HTMLElement) =>
      track(event, pageAppid ?? null, Number(card.dataset.appid), Number(card.dataset.position ?? 0));
    const observed = new WeakSet<Element>();
    const visible = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { visible.unobserve(entry.target); send("impression", entry.target as HTMLElement); }
    }, { threshold: 0.5 });
    const observeCards = () => grid.querySelectorAll<HTMLElement>(CARD).forEach(card => {
      if (!observed.has(card)) { observed.add(card); visible.observe(card); }
    });
    observeCards();
    const added = new MutationObserver(observeCards);
    added.observe(grid, { childList: true, subtree: true });
    const onClick = (event: MouseEvent) => {
      const card = (event.target as Element).closest<HTMLElement>(CARD);
      if (card) send("click_card", card);
    };
    grid.addEventListener("click", onClick);
    return () => { visible.disconnect(); added.disconnect(); grid.removeEventListener("click", onClick); };
  }, [pageAppid]);
  return <span ref={ref} hidden />;
}
