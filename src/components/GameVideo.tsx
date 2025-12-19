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
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:27',message:'GameVideo component initialized',data:{videos:videos,videosLength:videos?.length,headerImage:!!headerImage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrls = videos ?? [];
  const hasVideo = videoUrls.length > 0 && !videoError;
  const videoUrl = hasVideo ? videoUrls[0] : null;
  const isHls = videoUrl?.endsWith('.m3u8') || videoUrl?.includes('/hls_');
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:35',message:'Video state computed',data:{videoUrlsLength:videoUrls.length,hasVideo,videoUrl,isHls,videoError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:38',message:'useEffect triggered',data:{hasVideo,hasVideoUrl:!!videoUrl,hasVideoRef:!!videoRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!hasVideo || !videoUrl || !videoRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:41',message:'Early return from useEffect',data:{reason:!hasVideo?'no video':!videoUrl?'no url':'no ref'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return;
    }

    const video = videoRef.current;

    // Handle HLS videos
    if (isHls) {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:48',message:'HLS video detected',data:{videoUrl,isHlsSupported:typeof Hls !== 'undefined',hlsIsSupported:Hls?.isSupported?.()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:52',message:'HLS source loaded',data:{videoUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        hls.on(Hls.Events.ERROR, (event, data) => {
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:56',message:'HLS error event',data:{fatal:data.fatal,type:data.type,details:data.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:80',message:'Setting regular video src',data:{videoUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
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
          onError={(e) => {
            // #region agent log
            fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameVideo.tsx:95',message:'Video onError triggered',data:{error:typeof e === 'object'?e.type:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            setVideoError(true);
          }}
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
