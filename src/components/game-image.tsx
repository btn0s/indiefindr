"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameImageProps {
  altText: string;
  potentialImageUrls: string[];
  sizes: string; // Make sizes required for explicit control
}

export function GameImage({
  altText,
  potentialImageUrls,
  sizes,
}: GameImageProps) {
  const [imageIndex, setImageIndex] = useState(0);

  // Reset index if the potential URLs change
  useEffect(() => {
    setImageIndex(0);
  }, [potentialImageUrls]); // Re-run effect when the URL list changes

  const handleImageError = () => {
    setImageIndex((prevIndex) => prevIndex + 1);
  };

  const currentImageUrl = potentialImageUrls[imageIndex];

  return (
    <>
      {currentImageUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-md border aspect-cover-art" // Base styling
          )}
        >
          <Image
            key={currentImageUrl} // Key change forces re-render on fallback
            src={currentImageUrl}
            alt={altText}
            fill
            sizes={sizes}
            className="object-cover" // Apply image class
            onError={handleImageError}
          />
        </div>
      ) : (
        // Placeholder if no image is found or all fallbacks fail
        <div
          className={cn(
            "flex items-center justify-center rounded-md bg-muted text-muted-foreground shadow-sm aspect-cover-art"
          )}
        >
          <div className="flex flex-col items-center gap-1 text-center p-1">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">No Image</span>
          </div>
        </div>
      )}
    </>
  );
}
