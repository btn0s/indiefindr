"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BookmarkPlus, BookmarkCheck, Eye } from "lucide-react";
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type
import { GameImage } from "./game-image"; // Import the reusable GameImage component

interface GameCardMiniProps {
  game: {
    id: number;
    title: string | null;
    steamAppid: string | null;
    descriptionShort?: string | null;
    rawData?: SteamRawData | null; // Add rawData prop
  };
  detailsLinkHref: string;
  isInLibrary?: boolean;
  onAddToLibrary?: (gameId: number) => Promise<any>;
  onRemoveFromLibrary?: (gameId: number) => Promise<any>;
  className?: string;
}

export function GameCardMini({
  game,
  detailsLinkHref,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
  className,
}: GameCardMiniProps) {
  // Define potential cover art URLs
  const headerImageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;
  const rawData = game.rawData;
  const potentialCoverUrls = [
    headerImageUrl, // 1. header.jpg (from steamAppid)
    rawData?.capsule_image, // 2. capsule_image (medium)
    rawData?.capsule_imagev5, // 3. capsule_imagev5 (small)
    rawData?.screenshots?.[0]?.path_full, // 4. First full screenshot
    rawData?.background_raw, // 5. Raw background
    rawData?.background, // 6. Processed background
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  const altText = game.title
    ? `${game.title} header image`
    : "Game header image";
  const imageSizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw";

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if card is wrapped in Link
    e.stopPropagation();
    if (onAddToLibrary) {
      try {
        await onAddToLibrary(game.id);
      } catch (error) {
        console.error("Error adding to library:", error);
        // Potentially show a toast notification
      }
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    if (onRemoveFromLibrary) {
      try {
        await onRemoveFromLibrary(game.id);
      } catch (error) {
        console.error("Error removing from library:", error);
        // Potentially show a toast notification
      }
    }
  };

  return (
    <Card
      className={cn(
        "h-full flex flex-col overflow-hidden transition-shadow hover:shadow-lg",
        "py-0 gap-0", // Override default Card padding and gap
        className
      )}
    >
      <Link href={detailsLinkHref} className="block group">
        <GameImage
          altText={altText}
          potentialImageUrls={potentialCoverUrls}
          sizes={imageSizes}
          aspectRatioClassName="aspect-[460/215]" // Specific aspect ratio for mini card
          imageClassName="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          unoptimized={true} // Assuming unoptimized is desired here
        />
      </Link>
      <CardContent className="p-3 flex-grow flex flex-col">
        <Link href={detailsLinkHref} className="block">
          <h3
            className="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors"
            title={game.title || "Unknown Game"}
          >
            {game.title || "Unknown Game"}
          </h3>
        </Link>
        {game.descriptionShort && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-grow">
            {game.descriptionShort}
          </p>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-2 flex items-center gap-2">
        <Link
          href={detailsLinkHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1"
          )}
          title="View Details"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Details
        </Link>
        {onAddToLibrary && onRemoveFromLibrary && (
          <Button
            variant={isInLibrary ? "secondary" : "default"}
            size="sm"
            onClick={isInLibrary ? handleRemove : handleAdd}
            title={isInLibrary ? "Remove from Library" : "Add to Library"}
            className="flex-1"
          >
            {isInLibrary ? (
              <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isInLibrary ? "Saved" : "Save"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
