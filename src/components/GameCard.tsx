"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
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
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasVideo = videos?.length > 0 && !videoError;
  const videoUrl = hasVideo ? videos?.[0] : null;
  const isHls = videoUrl?.endsWith(".m3u8") || videoUrl?.includes("/hls_");

  // Check for reduced motion preference and mobile
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    setIsMobile(window.innerWidth < 768);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Intersection Observer for lazy loading (only load video, don't auto-play)
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Only load video if not mobile and not reduced motion
            if (!isMobile && !prefersReducedMotion) {
              setTimeout(() => setShouldLoadVideo(true), 100);
            }
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px",
        threshold: 0.1,
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isMobile, prefersReducedMotion]);

  // Handle hover/focus for video playback (desktop only)
  useEffect(() => {
    if (!cardRef.current || isMobile || prefersReducedMotion) return;

    const card = cardRef.current;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleEnter = () => {
      hoverTimeout = setTimeout(() => {
        setShouldPlayVideo(true);
      }, 150);
    };

    const handleLeave = () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      setShouldPlayVideo(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };

    card.addEventListener("mouseenter", handleEnter);
    card.addEventListener("mouseleave", handleLeave);
    card.addEventListener("focus", handleEnter, { capture: true });
    card.addEventListener("blur", handleLeave, { capture: true });

    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      card.removeEventListener("mouseenter", handleEnter);
      card.removeEventListener("mouseleave", handleLeave);
      card.removeEventListener("focus", handleEnter, { capture: true });
      card.removeEventListener("blur", handleLeave, { capture: true });
    };
  }, [isMobile, prefersReducedMotion]);

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
            enableWorker: true,
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
          if (header_image) video.poster = header_image;
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
      if (header_image) video.poster = header_image;
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
  }, [shouldLoadVideo, hasVideo, videoUrl, isHls, header_image]);

  // Control video playback based on hover/focus state
  useEffect(() => {
    if (!videoRef.current || !shouldLoadVideo) return;
    const video = videoRef.current;

    if (shouldPlayVideo) {
      void video.play().catch(() => {
        setVideoError(true);
      });
    } else {
      video.pause();
    }
  }, [shouldPlayVideo, shouldLoadVideo]);


  const handleCardClick = () => {
    track("game_card_click", {
      appid: appid.toString(),
      title,
    });
  };

  return (
    <Link href={`/games/${appid}`} className="block" prefetch={false} onClick={handleCardClick}>
      <div ref={cardRef}>
        <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam">
          {/* Always render image as base layer */}
          {header_image && (
            <Image
              src={header_image}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                videoReady && shouldPlayVideo ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
          {/* Video overlays image, fades in when ready (desktop hover/focus only) */}
          {shouldLoadVideo && hasVideo && videoUrl && !isMobile && !prefersReducedMotion && (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="metadata"
              poster={header_image || undefined}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                videoReady && shouldPlayVideo ? "opacity-100" : "opacity-0"
              }`}
              onCanPlay={() => {
                setVideoReady(true);
              }}
              onError={() => setVideoError(true)}
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
}

export default GameCard;
