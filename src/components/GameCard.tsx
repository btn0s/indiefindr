"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/tracking";
import Link from "next/link";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import {
  adjustedNote,
  bombSpans,
  shownScore,
  type ReviewQuality,
} from "@/lib/review-quality";
import { CardRating } from "./Rating";

export interface GameCardProps extends ReviewQuality {
  appid: number;
  title: string;
  header_image: string | null;
  review_count?: number;
  review_positive_pct?: number | null;
  /** Above the fold: fetch the art with the page instead of lazily. */
  preload?: boolean;
  pageAppid?: number;
  position?: number;
}

export function GameCard({
  appid,
  title,
  header_image,
  review_count = 0,
  review_positive_pct = null,
  clean_score,
  bomb_windows,
  preload = false,
  pageAppid,
  position = 0,
}: GameCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track("impression", pageAppid ?? null, appid, position);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [appid, pageAppid, position]);
  const { pct, rescued } = shownScore({
    review_positive_pct,
    review_count,
    clean_score,
    bomb_windows,
  });
  const content = (
    <div>
      <div className="game-card-art">
        {header_image && (
          <Image
            src={header_image}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            className="absolute inset-0 w-full h-full object-cover"
            preload={preload}
          />
        )}
      </div>
      <div className="game-card-title">
        <span>{title}</span>
      </div>
      <CardRating
        pct={pct}
        count={review_count}
        bombs={rescued ? bombSpans(bomb_windows).length : 0}
      />
    </div>
  );
  const link = (
    <Link
      ref={ref}
      onClick={() => track("click_card", pageAppid ?? null, appid, position)}
      href={`/games/${appid}`}
      className="game-card"
      prefetch
    />
  );
  if (!rescued) return <Link {...link.props}>{content}</Link>;
  return (
    <Tooltip delay={150}>
      <TooltipTrigger render={link}>{content}</TooltipTrigger>
      <TooltipContent className="review-tooltip">
        {adjustedNote(bombSpans(bomb_windows))}. Steam shows{" "}
        {review_positive_pct}%.
      </TooltipContent>
    </Tooltip>
  );
}
