"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";

interface GameVideoProps {
  videos: string[] | null;
  headerImage: string | null;
  alt: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  startTime?: number;
}

export function GameVideo({
  videos,
  headerImage,
  alt,
  className = "",
  autoPlay = false,
  muted = true,
  loop = true,
  startTime = 2,
}: GameVideoProps) {
  const [videoError, setVideoError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoUrls = videos ?? [];
  const hasVideo = videoUrls.length > 0 && !videoError;
  const videoUrl = hasVideo ? videoUrls[0] : null;
  const isHls = videoUrl?.endsWith('.m3u8') || videoUrl?.includes('/hls_');

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Load video after idle time or on user interaction (image-first for LCP)
  // If autoPlay is true, load and play immediately
  useEffect(() => {
    if (!hasVideo || !videoUrl || prefersReducedMotion) return;

    // If autoplay is enabled, load and play immediately
    if (autoPlay) {
      setShouldLoadVideo(true);
      setShouldPlayVideo(true);
      return;
    }

    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // Load video after 2s of idle time (allows image to be LCP)
    idleTimeout = setTimeout(() => {
      if (!cancelled) {
        setShouldLoadVideo(true);
      }
    }, 2000);

    // Or load immediately on user interaction
    const handleInteraction = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      if (!cancelled) {
        setShouldLoadVideo(true);
        setShouldPlayVideo(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("click", handleInteraction, { once: true });
      container.addEventListener("mouseenter", handleInteraction, { once: true });
      container.addEventListener("touchstart", handleInteraction, { once: true });
    }

    return () => {
      cancelled = true;
      if (idleTimeout) clearTimeout(idleTimeout);
      if (container) {
        container.removeEventListener("click", handleInteraction);
        container.removeEventListener("mouseenter", handleInteraction);
        container.removeEventListener("touchstart", handleInteraction);
      }
    };
  }, [hasVideo, videoUrl, prefersReducedMotion, autoPlay]);

  // Initialize video when shouldLoadVideo becomes true
  useEffect(() => {
    if (!shouldLoadVideo || !hasVideo || !videoUrl || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    const setStartTime = () => {
      if (startTime > 0 && video.duration > startTime) {
        video.currentTime = startTime;
      }
    };

    const tryPlay = () => {
      if (cancelled) return;
      if (autoPlay || shouldPlayVideo) {
        void video.play().catch(() => {
          setVideoError(true);
        });
      }
    };

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
            video.addEventListener("loadedmetadata", () => {
              setStartTime();
              tryPlay();
            }, { once: true });
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
          if (headerImage) video.poster = headerImage;
          video.addEventListener("loadedmetadata", () => {
            setStartTime();
            tryPlay();
          }, { once: true });
          video.addEventListener("canplay", tryPlay, { once: true });
        } else {
          setTimeout(() => setVideoError(true), 0);
        }
      })();
    } else {
      // Regular video format
      video.src = videoUrl;
      if (headerImage) video.poster = headerImage;
      video.addEventListener('loadedmetadata', () => {
        setStartTime();
        tryPlay();
      }, { once: true });
      video.addEventListener('canplay', tryPlay, { once: true });
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      hls = null;
    };
  }, [shouldLoadVideo, hasVideo, videoUrl, isHls, startTime, headerImage, autoPlay, shouldPlayVideo]);

  // Control video playback (fallback for when video is already loaded)
  useEffect(() => {
    if (!videoRef.current || !shouldLoadVideo) return;
    const video = videoRef.current;

    // Only try to play if video is already loaded and ready
    if ((shouldPlayVideo || autoPlay) && video.readyState >= 2) {
      void video.play().catch(() => {
        setVideoError(true);
      });
    }
  }, [shouldPlayVideo, shouldLoadVideo, autoPlay]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-lg bg-muted ${className}`}>
      {/* Show image first (LCP-friendly) - completely hidden when autoplay is enabled */}
      {headerImage && !autoPlay && (
        <Image
          src={headerImage}
          alt={alt}
          fill
          className={`object-cover transition-opacity duration-300 ${
            videoLoaded && shouldPlayVideo ? "opacity-0" : "opacity-100"
          }`}
          sizes="100vw"
          priority
        />
      )}
      {/* Video overlays image when loaded and playing */}
      {shouldLoadVideo && hasVideo && videoUrl && !prefersReducedMotion ? (
        <video
          ref={videoRef}
          muted={muted}
          loop={loop}
          playsInline
          preload={autoPlay ? "auto" : "metadata"}
          poster={autoPlay ? undefined : (headerImage || undefined)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            videoLoaded && (shouldPlayVideo || autoPlay) ? "opacity-100" : "opacity-0"
          }`}
          onLoadedData={() => {
            setVideoLoaded(true);
          }}
          onError={() => {
            setVideoError(true);
          }}
        />
      ) : !headerImage ? (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">No preview available</span>
        </div>
      ) : null}
    </div>
  );
}
