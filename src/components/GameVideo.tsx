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
  autoPlay = true,
  muted = true,
  loop = true,
  startTime = 2,
}: GameVideoProps) {
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrls = videos ?? [];
  const hasVideo = videoUrls.length > 0 && !videoError;
  const videoUrl = hasVideo ? videoUrls[0] : null;
  const isHls = videoUrl?.endsWith('.m3u8') || videoUrl?.includes('/hls_');

  useEffect(() => {
    if (!hasVideo || !videoUrl || !videoRef.current) {
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
            video.addEventListener("loadedmetadata", setStartTime, {
              once: true,
            });
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
          video.addEventListener("loadedmetadata", setStartTime, { once: true });
        } else {
          // Defer state update to avoid cascading renders in effect
          setTimeout(() => setVideoError(true), 0);
        }
      })();
    } else {
      // Regular video format
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', setStartTime, { once: true });
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      hls = null;
    };
  }, [hasVideo, videoUrl, isHls, startTime]);

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`} style={{ borderRadius: '6px', border: '1px solid', borderTopColor: 'rgba(0, 0, 0, 0.1)', borderLeftColor: 'rgba(0, 0, 0, 0.1)', borderBottomColor: 'rgba(255, 255, 255, 0.05)', borderRightColor: 'rgba(255, 255, 255, 0.05)' }}>
      {hasVideo && videoUrl ? (
        <video
          ref={videoRef}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          className="w-full h-full object-cover"
          style={{ borderRadius: '4px' }}
          onError={() => {
            setVideoError(true);
          }}
        />
      ) : headerImage ? (
        <Image
          src={headerImage}
          alt={alt}
          fill
          className="object-cover"
          style={{ borderRadius: '4px' }}
          sizes="100vw"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center" style={{ borderRadius: '4px' }}>
          <span className="text-muted-foreground text-sm">No preview available</span>
        </div>
      )}
      <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: '4px', boxShadow: 'inset 0 4px 12px rgba(0, 0, 0, 0.4)' }} />
    </div>
  );
}
