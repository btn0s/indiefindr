"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

interface GameVideoProps {
  videos: string[] | null;
  headerImage: string | null;
  alt: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export function GameVideo({
  videos,
  headerImage,
  alt,
  className = "",
  autoPlay = true,
  muted = true,
  loop = true,
}: GameVideoProps) {
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrls = videos ?? [];
  const hasVideo = videoUrls.length > 0 && !videoError;
  const videoUrl = hasVideo ? videoUrls[0] : null;
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
    <div className={`relative overflow-hidden rounded-lg bg-muted ${className}`}>
      {hasVideo && videoUrl ? (
        <video
          ref={videoRef}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          className="w-full h-full object-cover"
          onError={() => setVideoError(true)}
        />
      ) : headerImage ? (
        <Image
          src={headerImage}
          alt={alt}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">No preview available</span>
        </div>
      )}
    </div>
  );
}
