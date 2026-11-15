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

// An explicit pause holds for the rest of the visit: the next game page starts paused too.
const PAUSED_KEY = "indiefindr-trailer-paused";

/** The hero: the game's gameplay clip, muted and looping over its first screenshot from the moment the page opens
 *  (GameplayLoop: only while on screen, and never for reduced motion or Save-Data, which keep the still). The sound
 *  button swaps in the full trailer, with its sound, in the same frame. Pause (or K) holds for the rest of the visit. */
export function GameTrailer({ title, trailer, image }: { title: string; trailer: Trailer | null; image: string | null }) {
  // Steam's small copy of the same picture, warmed with the hero by the card that was opened (preloadHero): it fills
  // the frame at once and the optimised hero sharpens over it, so a cold image transform never leaves the frame empty.
  const base = image && smallCopy(image);
  const clip = trailer && clipUrl(trailer);
  const [full, setFull] = useState(false);
  const [muted, setMuted] = useState(true);
  // Read as the page hydrates. It shows only in the controls, which render once the video has loaded, so the server's
  // answer (never paused) can't disagree with anything on the page.
  const [paused, setPaused] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(PAUSED_KEY) === "1");
  const [loaded, setLoaded] = useState(false);
  if (trailer) preconnect("https://video.akamai.steamstatic.com");
  // A stream stored in an older layout has no clip; it plays muted in the clip's place, and sound just unmutes it.
  const src = trailer && (full ? trailer.url : clip ?? trailer.url);

  const hold = (next: boolean) => {
    setPaused(next);
    if (next) sessionStorage.setItem(PAUSED_KEY, "1"); else sessionStorage.removeItem(PAUSED_KEY);
  };
  // Sound on means watching: the first press swaps in the full trailer and plays it with sound, even from a pause.
  const toggleSound = () => {
    if (full) { setMuted(value => !value); return; }
    setFull(true);
    setMuted(false);
    hold(false);
  };

  return <div className="game-trailer" onKeyDown={event => { if (loaded && event.key.toLowerCase() === "k") hold(!paused); }}>
    <ArtMark />
    {/* Eager and decoded with the frame: the card's warm-up has usually fetched it already, so the cover has art on the
        page's first frame instead of an empty plate. The head script marks art as it loads (layout.tsx), hence
        suppressHydrationWarning on each. */}
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
