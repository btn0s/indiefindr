"use client";
import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import { ScreenshotViewer, thumbSrc } from "./ScreenshotViewer";

/** The game's screenshots in a row that scrolls and snaps inside itself. Each holds its 16:9 box before it
 *  loads, so nothing shifts. A tap opens the full-screen viewer, which grows out of the tapped shot. */
export function ScreenshotStrip({ title, screenshots }: { title: string; screenshots: string[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const strip = useRef<HTMLUListElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!screenshots.length) return null;

  return <>
    <ul ref={strip} className="screenshot-strip" aria-label={`${title} screenshots`}>
      {screenshots.map((src, index) => <li key={src} style={{ "--i": index } as CSSProperties}>
        <button type="button" ref={button => { thumbs.current[index] = button; }} onClick={() => setViewing(index)}
          aria-label={`Screenshot ${index + 1} of ${screenshots.length}, open full screen`}>
          {/* The first few are in view as the page arrives and cascade in with its entrance, so they load at once,
              decoded by the time their turn comes; the rest wait until they're scrolled near. */}
          <Image src={thumbSrc(src)} alt="" width={600} height={338} unoptimized loading={index < 3 ? "eager" : "lazy"} />
        </button>
      </li>)}
    </ul>
    {viewing !== null && <ScreenshotViewer title={title} screenshots={screenshots} start={viewing} thumbs={thumbs} strip={strip}
      onClosed={() => setViewing(null)} />}
  </>;
}
