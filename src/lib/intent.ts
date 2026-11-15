"use client";
import { ForesightManager } from "js.foresight";
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { HERO_SIZES, smallCopy } from "@/lib/hero";

export function preloadHero(src: string | null) {
  if (!src) return;
  preload(smallCopy(src), { as: "image", fetchPriority: "high" });
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: HERO_SIZES });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
}

let started = false;

export function watchIntent(element: HTMLElement, onIntent: () => void) {
  if (!started) {
    started = true;
    ForesightManager.initialize({ touchDeviceStrategy: "onTouchStart", minimumConnectionType: "3g" });
  }
  return ForesightManager.instance.register({ element, callback: onIntent, hitSlop: 16 }).unregister;
}
