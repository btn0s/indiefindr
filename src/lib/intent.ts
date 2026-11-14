"use client";
import { ForesightManager } from "js.foresight";
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { HERO_SIZES } from "@/lib/hero";

/** Fetches a game page's hero the way the page will ask for it: same optimizer widths, same sizes. */
export function preloadHero(src: string | null) {
  if (!src) return;
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: HERO_SIZES });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
}

let started = false;

/** Calls `onIntent` once, when the visitor is about to open `element`: the pointer heading for it (trajectory), Tab
 *  about to reach it, it scrolling under a resting cursor, or a finger landing on it. Skipped on Save-Data and slow
 *  connections. Returns the unregister function, for use as an effect cleanup. */
export function watchIntent(element: HTMLElement, onIntent: () => void) {
  if (!started) {
    started = true;
    ForesightManager.initialize({ touchDeviceStrategy: "onTouchStart", minimumConnectionType: "3g" });
  }
  return ForesightManager.instance.register({ element, callback: onIntent, hitSlop: 16 }).unregister;
}
