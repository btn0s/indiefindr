"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Sparkle } from "@/components/Sparkle";
import { watchIntent } from "@/lib/intent";
import { PackIcon } from "./PackIcon";
import * as sound from "./pack-sound";

const warm = () => import("./pack-scene");

export function PackEntry({ appid }: { appid: number }) {
  const href = `/pack/${appid}`;
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const [iris, setIris] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return watchIntent(element, () => { router.prefetch(href); void warm(); });
  }, [router, href]);

  useEffect(() => () => setIris(null), []);

  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    sound.wake();
    void warm();
    const box = event.currentTarget.getBoundingClientRect();
    setIris({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(href), reduced ? 0 : 460);
  };

  return (
    <>
      <Link ref={ref} href={href} className="button sparkle pack-entry" onClick={enter}>
        <Sparkle />
        <span className="sparkle-label"><PackIcon />Open a pack</span>
      </Link>
      {iris && createPortal(<div className="pack-curtain" style={{ "--x": `${iris.x}px`, "--y": `${iris.y}px` } as CSSProperties} />, document.body)}
    </>
  );
}
