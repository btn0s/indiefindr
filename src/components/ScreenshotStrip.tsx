"use client";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { smallCopy } from "@/lib/hero";
import { ScreenshotViewer } from "./ScreenshotViewer";
import { RailButtons } from "./RailButtons";

export function ScreenshotStrip({ title, screenshots }: { title: string; screenshots: string[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const strip = useRef<HTMLUListElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  if (!screenshots.length) return null;

  return <>
    <div className="screenshot-rail">
      <RailButtons rail={strip} controls={id} label="screenshots" className="screenshot-buttons" />
      <ul ref={strip} id={id} className="screenshot-strip" aria-label={`${title} screenshots`}>
        {screenshots.map((src, index) => <li key={src}>
          <button type="button" ref={button => { thumbs.current[index] = button; }} onClick={() => setViewing(index)}
            aria-label={`Screenshot ${index + 1} of ${screenshots.length}, open full screen`}>
            <Image src={smallCopy(src)} alt="" width={600} height={338} unoptimized loading={index < 3 ? "eager" : "lazy"} />
          </button>
        </li>)}
      </ul>
    </div>
    {viewing !== null && <ScreenshotViewer title={title} screenshots={screenshots} start={viewing} thumbs={thumbs} strip={strip}
      onClosed={() => setViewing(null)} />}
  </>;
}
