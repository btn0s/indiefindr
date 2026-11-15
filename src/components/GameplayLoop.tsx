"use client";
import { useEffect, useRef, useState } from "react";

type LoopState = { visible: boolean; paused: boolean; live: boolean };

const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

function attach(video: HTMLVideoElement, src: string, ready: () => void) {
  let hls: { destroy(): void } | undefined;
  let disposed = false;
  if (!src.endsWith(".m3u8") || video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    ready();
  } else {
    void import("hls.js").then(({ default: Hls }) => {
      if (disposed || !Hls.isSupported()) return;
      const player = new Hls({ capLevelToPlayerSize: true });
      hls = player;
      player.loadSource(src);
      player.attachMedia(video);
      player.on(Hls.Events.MANIFEST_PARSED, ready);
    });
  }
  return () => {
    disposed = true;
    hls?.destroy();
    video.pause();
    video.removeAttribute("src");
    video.load();
  };
}

function settle(video: HTMLVideoElement, { visible, paused, live }: LoopState) {
  if (!live) return;
  if (visible && !paused && !document.hidden) void video.play().catch(() => {});
  else video.pause();
}

export function GameplayLoop({ src, label, threshold, muted = true, paused = false, onLoaded }: {
  src: string;
  label?: string;
  threshold: number;
  muted?: boolean;
  paused?: boolean;
  onLoaded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const state = useRef<LoopState>({ visible: false, paused, live: false });
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia("(prefers-reduced-motion: reduce)").matches || saveData()) return;
    const loop = state.current;
    let teardown: (() => void) | undefined;
    const update = () => {
      if (loop.visible) teardown ??= attach(video, src, () => { loop.live = true; settle(video, loop); });
      settle(video, loop);
    };
    const observer = new IntersectionObserver(([entry]) => {
      loop.visible = entry.isIntersecting && entry.intersectionRatio >= threshold - 0.01;
      update();
    }, { threshold });
    observer.observe(video);
    const onVisibility = () => settle(video, loop);
    document.addEventListener("visibilitychange", onVisibility);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      loop.live = false;
      teardown?.();
    };
  }, [src, threshold]);

  useEffect(() => {
    state.current.paused = paused;
    if (ref.current) settle(ref.current, state.current);
  }, [paused]);

  return <video ref={ref} className="gameplay-loop" muted={muted} loop playsInline aria-label={label} aria-hidden={label ? undefined : true}
    onLoadedData={onLoaded} onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)} data-playing={playing} />;
}
