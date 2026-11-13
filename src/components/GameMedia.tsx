"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

export type Trailer = { title: string; url: string; poster: string | null };

function TrailerPlayer({ trailer }: { trailer: Trailer }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || video.canPlayType("application/vnd.apple.mpegurl")) return;
    let disposed = false;
    let controller: { destroy(): void; startLoad(): void } | undefined;
    const play = () => controller?.startLoad();
    video.addEventListener("play", play);
    import("hls.js").then(({ default: Hls }) => {
      if (disposed || !Hls.isSupported()) return;
      const hls = new Hls({ autoStartLoad: false });
      controller = hls;
      hls.loadSource(trailer.url);
      hls.attachMedia(video);
    });
    return () => { disposed = true; video.removeEventListener("play", play); controller?.destroy(); };
  }, [trailer.url]);
  return <video ref={ref} controls preload="none" playsInline poster={trailer.poster || undefined}
    src={undefined} className="h-full w-full" aria-label={trailer.title}
    onLoadedMetadata={(event) => { event.currentTarget.volume = 0.7; }}>
    <source src={trailer.url} type="application/vnd.apple.mpegurl" />
  </video>;
}

export function GameMedia({ title, header, screenshots, trailers }: {
  title: string; header: string | null; screenshots: string[]; trailers: Trailer[];
}) {
  const images = screenshots.length ? screenshots : header ? [header] : [];
  const slides = [...images.map((url, index) => ({ image: url, label: `${title} screenshot ${index + 1}`, trailer: null as Trailer | null })),
    ...trailers.map(trailer => ({ image: trailer.poster, label: trailer.title, trailer }))];
  const [active, setActive] = useState(0);
  if (!slides.length) return null;
  const slide = slides[active];
  const move = (delta: number) => setActive(index => (index + delta + slides.length) % slides.length);
  return <section className="game-media" aria-label={`${title} media`} onKeyDown={(event) => {
    if ((event.target as HTMLElement).tagName === "VIDEO") return;
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  }}>
    <div className="media-stage">
      {slide.trailer ? <TrailerPlayer key={slide.trailer.url} trailer={slide.trailer} /> : slide.image &&
        <Image key={slide.image} src={slide.image} alt={slide.label} fill priority={active === 0}
          sizes="(max-width: 800px) 100vw, 720px" className="object-contain" />}
      {!slide.trailer && slides.length > 1 && <div className="media-arrows">
        <button onClick={() => move(-1)} aria-label="Previous media"><ChevronLeft size={20} /></button>
        <button onClick={() => move(1)} aria-label="Next media"><ChevronRight size={20} /></button>
      </div>}
    </div>
    {slides.length > 1 && <div className="media-thumbnails">
      {slides.map((item, index) => <button key={`${item.image}-${index}`} aria-label={item.label}
        aria-pressed={index === active} onClick={() => setActive(index)}>
        {item.image && <Image src={item.image} alt="" fill sizes="100px" className="object-cover" />}
        {item.trailer && <Play size={18} fill="currentColor" className="thumbnail-play" />}
      </button>)}
    </div>}
  </section>;
}
