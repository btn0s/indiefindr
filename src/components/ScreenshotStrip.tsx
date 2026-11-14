"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { GameTrailer, type Trailer } from "./GameTrailer";
import { ScreenshotViewer, thumbSrc } from "./ScreenshotViewer";

/** The game's media in a row that scrolls and snaps inside itself: the trailer first, then the screenshots. Each tile
 *  holds its 16:9 box before it loads, so nothing shifts. A tap on a screenshot opens the full-screen viewer, which grows
 *  out of the tapped shot; the trailer plays in its own tile. */
export function ScreenshotStrip({ title, trailer, screenshots }: { title: string; trailer: Trailer | null; screenshots: string[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const strip = useRef<HTMLUListElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!screenshots.length && !trailer) return null;

  return <>
    <ul ref={strip} className="screenshot-strip" aria-label={trailer ? `${title} trailer and screenshots` : `${title} screenshots`}>
      {trailer && <li><GameTrailer title={title} trailer={trailer} /></li>}
      {screenshots.map((src, index) => <li key={src}>
        <button type="button" ref={button => { thumbs.current[index] = button; }} onClick={() => setViewing(index)}
          aria-label={`Screenshot ${index + 1} of ${screenshots.length}, open full screen`}>
          {/* The first few are in view as the page arrives, so they load at once; the rest wait until they're
              scrolled near. */}
          <Image src={thumbSrc(src)} alt="" width={600} height={338} unoptimized loading={index < 3 ? "eager" : "lazy"} />
        </button>
      </li>)}
    </ul>
    {viewing !== null && <ScreenshotViewer title={title} screenshots={screenshots} start={viewing} thumbs={thumbs} strip={strip}
      onClosed={() => setViewing(null)} />}
  </>;
}
