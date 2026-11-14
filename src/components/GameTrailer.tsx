"use client";
import { Button } from "@ui-sdk/react/button";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { HERO_SIZES, smallCopy } from "@/lib/hero";
import { ArtMark } from "./ArtMark";

export type Trailer = { title: string; url: string; poster: string | null };

// An explicit pause holds for the rest of the visit: the next game page starts paused too.
const PAUSED_KEY = "indiefindr-trailer-paused";
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/** The hero: a muted, looping trailer over its still. The stream starts only after the still has painted, when the
 *  browser is idle, so it never competes with the page's first images. It plays only while on screen and the tab is
 *  visible, and not at all for reduced motion or Save-Data, which keep the still. */
export function GameTrailer({ title, trailer, image }: { title: string; trailer: Trailer | null; image: string | null }) {
  // Steam's small copy of the same picture, warmed with the hero by the card that was opened (preloadHero): it fills
  // the frame at once and the optimised hero sharpens over it, so a cold image transform never leaves the frame empty.
  const base = image && smallCopy(image);
  const ref = useRef<HTMLVideoElement>(null);
  const [heroPainted, setHeroPainted] = useState(!image);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const userPaused = useRef(false);
  const inView = useRef(true);
  if (trailer) preconnect("https://video.akamai.steamstatic.com");

  const sync = () => {
    const video = ref.current;
    if (!video?.currentSrc && !video?.src) return;
    if (!userPaused.current && inView.current && !document.hidden) void video.play().catch(() => {});
    else video.pause();
  };

  useEffect(() => {
    const video = ref.current;
    if (!video || !trailer || !heroPainted || matchMedia("(prefers-reduced-motion: reduce)").matches || saveData()) return;
    userPaused.current = sessionStorage.getItem(PAUSED_KEY) === "1";
    setPaused(userPaused.current);
    let hls: { destroy(): void } | undefined;
    let disposed = false;
    const start = () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = trailer.url; sync(); return; }
      void import("hls.js").then(({ default: Hls }) => {
        if (disposed || !Hls.isSupported()) return;
        const player = new Hls({ capLevelToPlayerSize: true });
        hls = player;
        player.loadSource(trailer.url);
        player.attachMedia(video);
        player.on(Hls.Events.MANIFEST_PARSED, sync);
      });
    };
    // Not every Safari has requestIdleCallback; a short timeout stands in.
    const onIdle = window.requestIdleCallback as typeof requestIdleCallback | undefined;
    const idle = onIdle ? onIdle(start, { timeout: 1000 }) : window.setTimeout(start, 200);
    const visibility = new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; sync(); }, { threshold: 0.25 });
    visibility.observe(video);
    document.addEventListener("visibilitychange", sync);
    // Also runs when the route is kept but hidden after navigating away (Cache Components): stop, don't play unseen.
    return () => {
      disposed = true;
      if (onIdle) cancelIdleCallback(idle); else clearTimeout(idle);
      visibility.disconnect();
      document.removeEventListener("visibilitychange", sync);
      hls?.destroy();
      // Pausing alone leaves a native HLS stream buffering; dropping the source stops the download. The effect sets it
      // again if the page comes back.
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [trailer, heroPainted]);

  const togglePause = () => {
    const next = !paused;
    userPaused.current = next;
    setPaused(next);
    if (next) sessionStorage.setItem(PAUSED_KEY, "1"); else sessionStorage.removeItem(PAUSED_KEY);
    sync();
  };

  return <div className="game-trailer" onKeyDown={event => { if (loaded && event.key.toLowerCase() === "k") togglePause(); }}>
    <ArtMark />
    {/* Eager and decoded with the frame: the card's warm-up has usually fetched it already, so the cover has art on the
        page's first frame instead of an empty plate. The head script marks art as it loads (layout.tsx), hence
        suppressHydrationWarning on each. */}
    {base && <Image src={base} alt="" fill unoptimized loading="eager" fetchPriority="high" decoding="sync" className="object-cover" suppressHydrationWarning />}
    {image && <Image src={image} alt={`${title} screenshot`} fill preload sizes={HERO_SIZES} className="object-cover" suppressHydrationWarning
      onLoad={() => setHeroPainted(true)} onError={() => setHeroPainted(true)} />}
    {trailer && <video ref={ref} muted={muted} loop playsInline aria-label={`${title} trailer`}
      onLoadedData={() => setLoaded(true)} onPlaying={() => setPlaying(true)} data-playing={playing} />}
    {loaded && <div className="trailer-controls">
      <Button className="trailer-button" onClick={togglePause} aria-label={paused ? "Play trailer" : "Pause trailer"} data-on={paused || undefined}>
        <Pause size={16} className="icon-off" aria-hidden="true" /><Play size={16} className="icon-on" aria-hidden="true" />
      </Button>
      <Button className="trailer-button" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute trailer" : "Mute trailer"} data-on={muted || undefined}>
        <Volume2 size={16} className="icon-off" aria-hidden="true" /><VolumeX size={16} className="icon-on" aria-hidden="true" />
      </Button>
    </div>}
  </div>;
}
