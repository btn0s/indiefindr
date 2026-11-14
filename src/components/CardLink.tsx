"use client";
import Link, { useLinkStatus } from "next/link";
import { createContext, use, useEffect, useId, useRef, useSyncExternalStore, ViewTransition, type ComponentProps, type ReactNode } from "react";
import { preloadHero, watchIntent } from "@/lib/intent";

// The card the visitor opened last. Only that card names its art, so it morphs into the game page's hero (the title
// stays put and arrives with the page): a view-transition name may be mounted once, and the same game can sit in several grids at the same time.
let openedCard: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const CardId = createContext<string | null>(null);

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
  return <CardId value={id}>
    <Link ref={ref} href={`/games/${appid}`} prefetch={true} transitionTypes={["nav-forward"]}
      onClick={event => { openedCard = id; listeners.forEach(listener => listener()); onClick?.(event); }} {...props}>
      {children}
      <PendingMark />
    </Link>
  </CardId>;
}

/** Marks the card while its page is on the way, for a click that wasn't prefetched (globals.css dims the art after a
 *  beat, so instant navigations never show it). */
function PendingMark() {
  const { pending } = useLinkStatus();
  return <span hidden data-link-pending={pending || undefined} />;
}

/** The card's art, which morphs into the game page's hero when this is the card being opened. */
export function CardMorph({ appid, children }: { appid: number; children: ReactNode }) {
  const id = use(CardId);
  const opened = useSyncExternalStore(subscribe, () => openedCard === id, () => false);
  return <ViewTransition name={opened ? `art-${appid}` : undefined} share="art-morph" default="none">{children}</ViewTransition>;
}
