"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export type Trailer = { title: string; url: string; poster: string | null };

/** Muted, looping trailer that starts on its own; reduced-motion visitors and games without trailers see the still. */
export function GameTrailer({ title, trailer, still }: { title: string; trailer: Trailer | null; still: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const video = ref.current;
    if (!video || !trailer || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let hls: { destroy(): void } | undefined;
    let disposed = false;
    const play = () => { void video.play().catch(() => {}); };
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = trailer.url; play(); }
    else import("hls.js").then(({ default: Hls }) => {
      if (disposed || !Hls.isSupported()) return;
      const player = new Hls({ capLevelToPlayerSize: true });
      hls = player;
      player.loadSource(trailer.url);
      player.attachMedia(video);
      player.on(Hls.Events.MANIFEST_PARSED, play);
    });
    return () => { disposed = true; hls?.destroy(); };
  }, [trailer]);
  const image = trailer?.poster ?? still;
  return <div className="game-trailer">
    {image && <Image src={image} alt={`${title} screenshot`} fill preload sizes="(max-width: 900px) 100vw, 870px" className="object-cover" />}
    {trailer && <video ref={ref} muted={muted} loop playsInline aria-label={`${title} trailer`}
      onPlaying={() => setPlaying(true)} data-playing={playing} />}
    {playing && <button className="trailer-sound" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute trailer" : "Mute trailer"}>
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>}
  </div>;
}
