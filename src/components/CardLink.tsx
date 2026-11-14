"use client";
import Link, { useLinkStatus } from "next/link";
import { createContext, use, useEffect, useId, useRef, useState, useSyncExternalStore, ViewTransition, type ComponentProps, type ReactNode } from "react";
import { preloadHero, watchIntent } from "@/lib/intent";

// The card the visitor opened last. Only that card names its art and title, so they morph into the game page's hero
// and title: a view-transition name may be mounted once, and the same game can sit in several grids at the same time.
let openedCard: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const CardId = createContext<string | null>(null);

type CardLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  appid: number;
  /** The game page's hero, warmed along with the page. */
  hero: string | null;
  /** On the first screen: fetch the whole page now rather than waiting for intent. */
  eager?: boolean;
};

/** A link to a game page. Every card shares one prefetched App Shell; the full page and its hero are fetched only
 *  when the visitor is about to open this one (or at once, for the first screen). */
export function CardLink({ appid, hero, eager = false, children, onClick, ...props }: CardLinkProps) {
  const id = useId();
  const ref = useRef<HTMLAnchorElement>(null);
  const [warm, setWarm] = useState(eager);
  useEffect(() => {
    if (!ref.current) return;
    return watchIntent(ref.current, () => { setWarm(true); preloadHero(hero); });
  }, [hero]);
  return <CardId value={id}>
    <Link ref={ref} href={`/games/${appid}`} prefetch={warm ? true : "auto"} transitionTypes={["nav-forward"]}
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

/** Part of a card that morphs into its counterpart on the game page, when this is the card being opened. */
export function CardMorph({ part, appid, children }: { part: "art" | "title"; appid: number; children: ReactNode }) {
  const id = use(CardId);
  const opened = useSyncExternalStore(subscribe, () => openedCard === id, () => false);
  return <ViewTransition name={opened ? `${part}-${appid}` : undefined} share={`${part}-morph`} default="none">{children}</ViewTransition>;
}
