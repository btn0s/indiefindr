"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const videos = game.videos ?? [];
  const hasVideo = videos.length > 0 && !videoError;
  const videoUrl = hasVideo ? videos[0] : null;
  const isHls = videoUrl?.endsWith('.m3u8') || videoUrl?.includes('/hls_');

  useEffect(() => {
    if (!hasVideo || !videoUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Handle HLS videos
    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setVideoError(true);
                break;
            }
          }
        });

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = videoUrl;
      } else {
        setVideoError(true);
      }
    } else {
      // Regular video format
      video.src = videoUrl;
    }
  }, [hasVideo, videoUrl, isHls]);

  return (
    <Link href={`/games/${game.appid}`} className="block">
      <div>
        <div className="relative w-full h-32 mb-2 overflow-hidden rounded-md bg-muted">
          {hasVideo && videoUrl ? (
            <video
              ref={videoRef}
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
