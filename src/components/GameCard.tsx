"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import type { GameNew } from "@/lib/supabase/types";

type GameCardProps = GameNew & {
  explanation?: string;
};

function GameCard({
  appid,
  videos,
  title,
  header_image,
  explanation,
}: GameCardProps) {
  const [videoError, setVideoError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasVideo = videos?.length > 0 && !videoError;
  const videoUrl = hasVideo ? videos?.[0] : null;
  const isHls = videoUrl?.endsWith(".m3u8") || videoUrl?.includes("/hls_");

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Delay video loading slightly to prioritize images
            setTimeout(() => setShouldLoadVideo(true), 100);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading slightly before visible
        threshold: 0.1,
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load video only when card is visible and should load
  useEffect(() => {
    if (!shouldLoadVideo || !hasVideo || !videoUrl || !videoRef.current) return;

    const video = videoRef.current;
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    // Handle HLS videos
    if (isHls) {
      void (async () => {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;

        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: false,
          });
          hls.loadSource(videoUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls?.recoverMediaError();
                break;
              default:
                hls?.destroy();
                hls = null;
                setVideoError(true);
                break;
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS support (Safari)
          video.src = videoUrl;
        } else {
          setTimeout(() => setVideoError(true), 0);
        }
      })();
    } else {
      // Regular video format
      video.src = videoUrl;
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      hls = null;
    };
  }, [shouldLoadVideo, hasVideo, videoUrl, isHls]);

  const handleCardClick = () => {
    track("game_card_click", {
      appid: appid.toString(),
      title,
    });
  };

  return (
    <Link
      href={`/games/${appid}`}
      className="block group"
      onClick={handleCardClick}
    >
      <div
        ref={cardRef}
        className="retro-panel transition-[filter,transform] hover:brightness-[1.03]"
      >
        <div className="p-3 pb-2">
          <div className="relative w-full overflow-hidden bg-muted aspect-steam retro-frame">
          {/* Always render image as base layer */}
          {header_image && (
            <Image
              src={header_image}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                videoReady ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
          {/* Video overlays image, fades in when ready */}
          {shouldLoadVideo && hasVideo && videoUrl && (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                videoReady ? "opacity-100" : "opacity-0"
              }`}
              onCanPlay={() => setVideoReady(true)}
              onError={() => setVideoError(true)}
            />
          )}
          {/* Gloss overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,.55),rgba(255,255,255,0)_55%)] opacity-60" />
        </div>
        </div>

        <div className="px-3 pb-3">
          <div className="font-bold text-sm leading-snug line-clamp-2">
            {title}
          </div>
        {explanation && (
          <div className="mt-1 text-xs text-muted-foreground first-letter:uppercase line-clamp-3">
            {explanation}
          </div>
        )}
        </div>
      </div>
    </Link>
  );
}

export default GameCard;
