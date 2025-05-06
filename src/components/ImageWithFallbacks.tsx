"use client";

import React, { useState, ImgHTMLAttributes } from "react";

interface ImageWithFallbacksProps extends ImgHTMLAttributes<HTMLImageElement> {
  sources: string[];
  fallbackSrc?: string; // Optional explicit fallback if all sources fail
  alt: string;
}

export function ImageWithFallbacks({
  sources,
  fallbackSrc,
  alt,
  className,
  ...props
}: ImageWithFallbacksProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(sources[0]);

  const handleError = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < sources.length) {
      setCurrentIndex(nextIndex);
      setCurrentSrc(sources[nextIndex]);
    } else if (fallbackSrc) {
      // If all sources failed, try the explicit fallback
      setCurrentSrc(fallbackSrc);
    } else {
      // If no explicit fallback, maybe render a placeholder or nothing
      // For now, let it show the browser's broken image icon
      console.error("All image sources failed for:", alt);
    }
  };

  // If sources array is empty, immediately use fallback or render nothing
  if (!sources || sources.length === 0) {
    if (fallbackSrc) {
      return (
        <img src={fallbackSrc} alt={alt} className={className} {...props} />
      );
    }
    // Render a placeholder or return null if no sources and no fallback
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${
          className || ""
        }`}
      >
        ?
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      onError={handleError}
      alt={alt}
      className={className}
      {...props}
    />
  );
}
