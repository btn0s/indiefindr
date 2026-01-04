"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import type { GameCardGame } from "@/lib/supabase/types";

type GameCardProps = GameCardGame & {
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
  const [isPressed, setIsPressed] = useState(false);
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

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.addEventListener(
              "loadedmetadata",
              () => {
                if (video.duration > 5) {
                  video.currentTime = 5;
                }
              },
              { once: true }
            );
          });

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
          video.addEventListener(
            "loadedmetadata",
            () => {
              if (video.duration > 5) {
                video.currentTime = 5;
              }
            },
            { once: true }
          );
        } else {
          setTimeout(() => setVideoError(true), 0);
        }
      })();
    } else {
      // Regular video format
      video.src = videoUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (video.duration > 5) {
            video.currentTime = 5;
          }
        },
        { once: true }
      );
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
    <Link href={`/games/${appid}`} className="block h-full" onClick={handleCardClick}>
      <div 
        ref={cardRef} 
        className={cn(
          "cartridge h-full flex flex-col group transition-all duration-150 ease-out",
          isPressed && "cartridge-button-pressed translate-y-0.5"
        )}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
      >
        {/* Label area */}
        <div className="cartridge-label relative overflow-hidden">
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
              onCanPlay={() => {
                setVideoReady(true);
              }}
              onError={() => setVideoError(true)}
            />
          )}
          {/* Simple glossy overlay */}
          <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        </div>
        
        {/* Divider */}
        <div className="cartridge-divider-line" />
        
        {/* Cartridge body with text */}
        <div className="cartridge-body flex-1 flex flex-col justify-start">
          <div className="px-3 py-2">
            <div className="font-medium text-xs text-[#000000] mb-0.5 leading-tight">{title}</div>
            {explanation && (
              <div className="text-[10px] text-[#404040] first-letter:uppercase leading-tight">
                {explanation}
              </div>
            )}
          </div>
          
          {/* Bottom connector pins */}
          <div className="cartridge-pins mt-auto">
            <div className="cartridge-pin-row" />
            <div className="cartridge-pin-row" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default GameCard;
