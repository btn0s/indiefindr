"use client";
import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Steam serves each screenshot at fixed sizes beside the original; the strip takes the 600px one. */
const sized = (src: string, size: string) => src.replace(/(\/ss_[0-9a-f]+)\.jpg/, `$1.${size}.jpg`);

/** The game's screenshots in a row that scrolls and snaps inside itself. Each is lazy and holds its 16:9 box before
 *  it loads, so nothing shifts. A tap opens a full-screen viewer: swipe or arrow keys between shots, tap or Esc to
 *  close. The viewer's images load only once it is open. */
export function ScreenshotStrip({ title, screenshots }: { title: string; screenshots: string[] }) {
  const viewer = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  // The shot being shown or scrolled to, so quick repeated arrows count from where the last one was headed.
  const shown = useRef(0);
  if (!screenshots.length) return null;

  const open = (index: number) => {
    viewer.current?.showModal();
    shown.current = index;
    if (track.current) track.current.scrollLeft = index * track.current.clientWidth;
  };
  const step = (direction: number) => {
    if (!track.current) return;
    shown.current = Math.min(screenshots.length - 1, Math.max(0, shown.current + direction));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current.scrollTo({ left: shown.current * track.current.clientWidth, behavior: reduce ? "instant" : "smooth" });
  };

  return <>
    <ul className="screenshot-strip" aria-label={`${title} screenshots`}>
      {screenshots.map((src, index) => <li key={src}>
        <button type="button" onClick={() => open(index)} aria-label={`Screenshot ${index + 1} of ${screenshots.length}, open full screen`}>
          <Image src={sized(src, "600x338")} alt="" width={600} height={338} unoptimized loading="lazy" />
        </button>
      </li>)}
    </ul>
    <dialog ref={viewer} className="screenshot-viewer" aria-label={`${title} screenshots`}
      onClick={() => viewer.current?.close()}
      onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); }
      }}>
      <div ref={track} className="screenshot-track"
        onScrollEnd={event => { shown.current = Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth); }}>
        {screenshots.map((src, index) => <figure key={src}>
          <Image src={src} alt={`${title} screenshot ${index + 1} of ${screenshots.length}`} fill sizes="100vw" loading="lazy" />
        </figure>)}
      </div>
      <button type="button" className="viewer-button viewer-close" aria-label="Close"><X size={20} /></button>
      <button type="button" className="viewer-button viewer-prev" aria-label="Previous screenshot"
        onClick={event => { event.stopPropagation(); step(-1); }}><ChevronLeft size={22} /></button>
      <button type="button" className="viewer-button viewer-next" aria-label="Next screenshot"
        onClick={event => { event.stopPropagation(); step(1); }}><ChevronRight size={22} /></button>
    </dialog>
  </>;
}
