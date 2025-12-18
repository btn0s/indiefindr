"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { RelatedGame } from "@/lib/supabase/types";

interface RelatedGameCardProps {
  game: RelatedGame | {
    appid: number;
    name: string;
    header_image: string | null;
    videos: string[] | null;
    similarity?: number;
  };
}

export function RelatedGameCard({ game }: RelatedGameCardProps) {
  const [videoError, setVideoError] = useState(false);
  const videos = game.videos ?? [];
  const hasVideo = videos.length > 0 && !videoError;
  const videoUrl = hasVideo ? videos[0] : null;

  return (
    <Link href={`/games/${game.appid}`} className="block">
      <div>
        <div className="relative w-full h-32 mb-2 overflow-hidden rounded-md bg-muted">
          {hasVideo && videoUrl ? (
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              onError={() => setVideoError(true)}
            />
          ) : game.header_image ? (
            <Image
              src={game.header_image}
              alt={game.name}
              width={400}
              height={128}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : null}
        </div>
        <div className="font-medium text-sm">{game.name}</div>
        {game.similarity !== undefined && (
          <div className="text-xs text-muted-foreground">
            Similarity: {(game.similarity * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </Link>
  );
}
