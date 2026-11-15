"use client";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, type ComponentProps } from "react";
import { preloadHero, watchIntent } from "@/lib/intent";

type CardLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  appid: number;
  hero: string | null;
};

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

function PendingMark() {
  const { pending } = useLinkStatus();
  return <span hidden data-link-pending={pending || undefined} />;
}
