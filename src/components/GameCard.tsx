"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/tracking";
import Link from "next/link";
import Image from "next/image";
import { CardRating } from "./Rating";

export interface GameCardProps {
  appid: number;
  title: string;
  header_image: string | null;
  review_count?: number;
  review_positive_pct?: number | null;
  priority?: boolean;
  pageAppid?: number;
  position?: number;
}

export function GameCard({
  appid,
  title,
  header_image,
  review_count = 0,
  review_positive_pct = null,
  priority = false,
  pageAppid, position = 0,
}: GameCardProps) {
  const ref=useRef<HTMLAnchorElement>(null);
  useEffect(()=>{if(!ref.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){track('impression',pageAppid??null,appid,position);observer.disconnect();}},{threshold:0.5});observer.observe(ref.current);return ()=>observer.disconnect();},[appid,pageAppid,position]);
  return (
    <Link ref={ref} onClick={()=>track('click_card',pageAppid??null,appid,position)} href={`/games/${appid}`} className="game-card" prefetch={true}>
      <div>
        <div className="game-card-art">
          {header_image && (
            <Image
              src={header_image}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              className="absolute inset-0 w-full h-full object-cover"
              priority={priority}
            />
          )}
        </div>
        <div className="game-card-title"><span>{title}</span></div>
        <CardRating pct={review_positive_pct} count={review_count} />
      </div>
    </Link>
  );
}
