"use client";
import { Button } from "@ui-sdk/react/button";
import Image from "next/image";
import { useState } from "react";
import { preconnect } from "react-dom";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { HERO_SIZES, smallCopy } from "@/lib/hero";
import { clipUrl, type Trailer } from "@/lib/trailer";
import { ArtMark } from "./ArtMark";
import { GameplayLoop } from "./GameplayLoop";

const PAUSED_KEY = "indiefindr-trailer-paused";

export function GameTrailer({ title, trailer, image }: { title: string; trailer: Trailer | null; image: string | null }) {
  const base = image && smallCopy(image);
  const clip = trailer && clipUrl(trailer);
  const [full, setFull] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(PAUSED_KEY) === "1");
  const [loaded, setLoaded] = useState(false);
  if (trailer) preconnect("https://video.akamai.steamstatic.com");
  const src = trailer && (full ? trailer.url : clip ?? trailer.url);

  const hold = (next: boolean) => {
    setPaused(next);
    if (next) sessionStorage.setItem(PAUSED_KEY, "1"); else sessionStorage.removeItem(PAUSED_KEY);
  };
  const toggleSound = () => {
    if (full) { setMuted(value => !value); return; }
    setFull(true);
    setMuted(false);
    hold(false);
  };

  return <div className="game-trailer" onKeyDown={event => { if (loaded && event.key.toLowerCase() === "k") hold(!paused); }}>
    <ArtMark />
    {base && <Image src={base} alt="" fill unoptimized loading="eager" fetchPriority="high" decoding="sync" className="object-cover" suppressHydrationWarning />}
    {image && <Image src={image} alt={`${title} screenshot`} fill preload sizes={HERO_SIZES} className="object-cover" suppressHydrationWarning />}
    {src && <GameplayLoop src={src} label={`${title} trailer`} threshold={0.25} muted={muted} paused={paused} onLoaded={() => setLoaded(true)} />}
    {loaded && <div className="trailer-controls">
      <Button className="trailer-button" onClick={() => hold(!paused)} aria-label={paused ? "Play trailer" : "Pause trailer"} data-on={paused || undefined}>
        <Pause size={16} className="icon-off" aria-hidden="true" /><Play size={16} className="icon-on" aria-hidden="true" />
      </Button>
      <Button className="trailer-button" onClick={toggleSound} aria-label={!muted ? "Mute trailer" : full ? "Unmute trailer" : "Play trailer with sound"} data-on={muted || undefined}>
        <Volume2 size={16} className="icon-off" aria-hidden="true" /><VolumeX size={16} className="icon-on" aria-hidden="true" />
      </Button>
    </div>}
  </div>;
}
