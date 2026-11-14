"use client";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useId, useRef, type ComponentProps } from "react";
import { preloadHero, watchIntent } from "@/lib/intent";
import { openCard } from "@/lib/card-morph";

type CardLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  appid: number;
  /** The game page's hero image, warmed when the visitor is about to open the card. */
  hero: string | null;
};

/** A link to a game page. Every card on screen prefetches its whole page, so opening one never waits on the network;
 *  the hero image, which the prefetch doesn't carry, is fetched when the visitor is about to open this one. */
export function CardLink({ appid, hero, children, onClick, ...props }: CardLinkProps) {
  const id = useId();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return watchIntent(ref.current, () => preloadHero(hero));
  }, [hero]);
  // data-card: only the card being opened (or closed into) carries view-transition names, and only its game's page
  // (card-morph.ts).
  return <Link ref={ref} data-card={id} href={`/games/${appid}`} prefetch={true} transitionTypes={["card-open"]}
      onClick={event => {
        // The card's surface (its first child), the box that expands into the page's sheet.
        const box = (event.currentTarget.firstElementChild ?? event.currentTarget).getBoundingClientRect();
        const art = event.currentTarget.querySelector<HTMLImageElement>(".game-card-art img")?.currentSrc || null;
        openCard({ appid, card: id, art, center: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          box: { x: box.left, y: box.top, w: box.width, h: box.height } }, event.currentTarget);
        markLeavingPage(event.currentTarget);
        onClick?.(event);
      }} {...props}>
      {children}
      <PendingMark />
    </Link>;
}

/** Marks the card while its page is on the way, for a click that wasn't prefetched (globals.css dims the art after a
 *  beat, so instant navigations never show it). */
function PendingMark() {
  const { pending } = useLinkStatus();
  return <span hidden data-link-pending={pending || undefined} />;
}

/** Marks the page being left (globals.css: it recedes while a card opens, and its content sinks while one closes), so
 *  the arriving page's content can be told from it. Opening, it also records where the page sits, so it recedes about
 *  the middle of the screen and comes back from there. */
export function markLeavingPage(from?: Element) {
  for (const main of document.querySelectorAll("main[data-leaving]")) main.removeAttribute("data-leaving");
  const main = from ? from.closest("main") : [...document.querySelectorAll("main")].find(main => main.checkVisibility());
  if (!main) return;
  main.setAttribute("data-leaving", "");
  if (!from) return;
  document.documentElement.style.setProperty("--page-origin-y", `${Math.round(innerHeight / 2 - main.getBoundingClientRect().top)}px`);
}
