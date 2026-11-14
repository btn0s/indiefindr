"use client";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, type ComponentProps } from "react";
import { preloadHero, watchIntent } from "@/lib/intent";

type CardLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  appid: number;
  /** The game page's hero image, warmed when the visitor is about to open the card. */
  hero: string | null;
};

/** A link to a game page. Every card on screen prefetches its whole page, so opening one never waits on the network;
 *  the hero image, which the prefetch doesn't carry, is fetched when the visitor is about to open this one. */
export function CardLink({ appid, hero, children, ...props }: CardLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return watchIntent(ref.current, () => preloadHero(hero));
  }, [hero]);
  return <Link ref={ref} href={`/games/${appid}`} prefetch={true} {...props}>
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
