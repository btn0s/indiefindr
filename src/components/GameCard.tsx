"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";

export interface GameCardProps {
  appid: number;
  title: string;
  header_image: string | null;
  explanation?: string;
  priority?: boolean;
}

export const GameCard = memo(function GameCard({
  appid,
  title,
  header_image,
  explanation,
  priority = false,
}: GameCardProps) {
  return (
    <Link href={`/games/${appid}`} className="block game-card-item" prefetch={false}>
      <div>
        <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam">
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
        <div className="font-medium text-sm">{title}</div>
        {explanation && (
          <div className="text-xs text-muted-foreground first-letter:uppercase">
            {explanation}
          </div>
        )}
      </div>
    </Link>
  );
});

export function GameCardNotFound({ explanation }: { explanation?: string }) {
  return (
    <div>
      <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Game not found</span>
      </div>
      <div className="font-medium text-sm text-muted-foreground">
        Unknown Game
      </div>
      {explanation && (
        <div className="text-xs text-muted-foreground first-letter:uppercase">
          {explanation}
        </div>
      )}
    </div>
  );
}
