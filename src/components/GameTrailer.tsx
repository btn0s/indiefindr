"use client";
import { Button } from "@ui-sdk/react/button";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

export type Trailer = { title: string; url: string; poster: string | null };

/** A tile of the media row (globals.css, .screenshot-strip li): most of a phone's width, a third of the column. */
const TILE_SIZES = "(min-width: 1096px) 340px, (min-width: 640px) 33vw, 80vw";

/** The trailer, first in the media row: its poster under a play button until asked for, then it streams and plays in
 *  place, with sound, under the pause and mute buttons (K toggles pause). Nothing loads before the tap. It pauses while
 *  scrolled away or while the tab is hidden and carries on when back; leaving the page stops the stream, and coming
 *  back finds it paused. */
export function GameTrailer({ title, trailer }: { title: string; trailer: Trailer }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  // The visitor wants it playing: set by play, cleared by pause, by the end, and by leaving the page.
  const wanted = useRef(false);
  const inView = useRef(true);
  preconnect("https://video.akamai.steamstatic.com");

  const native = (video: HTMLVideoElement) => video.canPlayType("application/vnd.apple.mpegurl") !== "";
  const sync = () => {
    const video = ref.current;
    if (!video?.currentSrc && !video?.src) return;
    if (wanted.current && inView.current && !document.hidden) void video.play().catch(() => {});
    else video.pause();
  };

  useEffect(() => {
    const video = ref.current;
    if (!started || !video) return;
    let hls: { destroy(): void } | undefined;
    let disposed = false;
    if (native(video)) {
      if (!video.getAttribute("src")) video.src = trailer.url;
      sync();
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (disposed || !Hls.isSupported()) return;
        const player = new Hls({ capLevelToPlayerSize: true });
        hls = player;
        player.loadSource(trailer.url);
        player.attachMedia(video);
        player.on(Hls.Events.MANIFEST_PARSED, sync);
      });
    }
    const visibility = new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; sync(); }, { threshold: 0.25 });
    visibility.observe(video);
    document.addEventListener("visibilitychange", sync);
    // Also runs when the route is kept but hidden after navigating away (Cache Components): stop, don't play unseen.
    return () => {
      disposed = true;
      wanted.current = false;
      visibility.disconnect();
      document.removeEventListener("visibilitychange", sync);
      hls?.destroy();
      // Pausing alone leaves a native HLS stream buffering; dropping the source stops the download. The effect sets it
      // again if the page comes back.
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [started, trailer]);

  const play = () => {
    const video = ref.current;
    if (!video) return;
    wanted.current = true;
    if (started) return sync();
    // Safari streams HLS itself; starting it inside the tap is what lets it play with sound. Elsewhere hls.js attaches
    // in the effect, and the tap has already unlocked sound for the page.
    if (native(video)) {
      video.src = trailer.url;
      void video.play().catch(() => {});
    }
    setStarted(true);
  };
  const pause = () => { wanted.current = false; ref.current?.pause(); };

  return <div className="game-trailer" onKeyDown={event => { if (started && event.key.toLowerCase() === "k") (paused ? play : pause)(); }}>
    {trailer.poster && <Image src={trailer.poster} alt="" fill sizes={TILE_SIZES} className="object-cover" />}
    <video ref={ref} muted={muted} playsInline aria-label={`${title} trailer`} data-playing={playing}
      onPlaying={() => setPlaying(true)} onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
      onEnded={() => { wanted.current = false; }} />
    {!started && <button type="button" className="trailer-start" onClick={play} aria-label={`Play ${title} trailer`}>
      <span className="trailer-start-mark"><Play size={20} fill="currentColor" aria-hidden="true" /></span>
    </button>}
    {started && <div className="trailer-controls">
      <Button className="trailer-button" onClick={paused ? play : pause} aria-label={paused ? "Play trailer" : "Pause trailer"} data-on={paused || undefined}>
        <Pause size={16} className="icon-off" aria-hidden="true" /><Play size={16} className="icon-on" aria-hidden="true" />
      </Button>
      <Button className="trailer-button" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute trailer" : "Mute trailer"} data-on={muted || undefined}>
        <Volume2 size={16} className="icon-off" aria-hidden="true" /><VolumeX size={16} className="icon-on" aria-hidden="true" />
      </Button>
    </div>}
  </div>;
}
