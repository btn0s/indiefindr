"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, memo } from "react";
import Hls from "hls.js";
import type { GameNew } from "@/lib/supabase/types";

function GameCard({
  appid,
  screenshots,
  videos,
  title,
  header_image,
  short_description,
  long_description,
  raw,
}: GameNew) {
  const [videoError, setVideoError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
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
            setIsVisible(true);
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
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = videoUrl;
      } else {
        setTimeout(() => setVideoError(true), 0);
      }
    } else {
      // Regular video format
      video.src = videoUrl;
    }
  }, [shouldLoadVideo, hasVideo, videoUrl, isHls]);

  return (
    <Link href={`/games/${appid}`} className="block">
      <div ref={cardRef}>
        <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-video">
          {shouldLoadVideo && hasVideo && videoUrl ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              onError={() => setVideoError(true)}
            />
          ) : header_image ? (
            <Image
              src={header_image}
              alt={title}
              width={400}
              height={128}
              className="w-full h-full object-cover"
              loading="lazy"
              unoptimized
            />
          ) : null}
        </div>
        <div className="font-medium text-sm">{title}</div>
      </div>
    </Link>
  );
}

export default GameCard;
