"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SteamRawData } from "@/types/steam";

interface GameImageProps {
  gameData: SteamRawData | null; // Use the combined game data type
  altText: string;
  sizes: string;
  variant?: "outlined" | "plain";
}

export function GameImage({
  altText,
  gameData,
  sizes,
  variant = "outlined",
}: GameImageProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [urlsToTry, setUrlsToTry] = useState<string[]>([]);

  console.log("gameData", gameData);

  // Construct the list of URLs to try from gameData
  useEffect(() => {
    const headerUrl = gameData?.header_image;
    // Safely access screenshots within the gameData object itself
    const screenshotUrls =
      gameData?.screenshots // Changed from gameData?.rawData?.screenshots
        ?.map((s: any) => s?.path_full) // Access path_full safely
        // Filter out any null, undefined, or empty strings from the map result
        .filter(
          (url: any): url is string => typeof url === "string" && url.length > 0
        ) ?? [];

    const combinedUrls = [headerUrl, ...screenshotUrls].filter(
      (url): url is string => Boolean(url) && typeof url === "string"
    );

    setUrlsToTry(combinedUrls);
    setImageIndex(0); // Reset index when gameData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData]); // Re-run effect only when gameData changes

  const handleImageError = () => {
    setImageIndex((prevIndex) => prevIndex + 1);
  };

  const currentImageUrl = urlsToTry[imageIndex];

  return (
    <>
      {currentImageUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden aspect-cover-art",
            variant === "outlined" && "border rounded-md"
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
            quality={100}
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
