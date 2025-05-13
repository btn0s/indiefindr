"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
// Import Card components
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BookmarkPlus, BookmarkCheck, Eye, ImageOff } from "lucide-react";
import { MediaCarousel } from "@/components/media-carousel"; // Import MediaCarousel
import type { MediaItem, SteamRawData, Movie, Screenshot } from "@/types/steam"; // Updated import path

interface GameCardProps {
  game: {
    id: number;
    title: string | null;
    shortDescription: string | null; // Renamed to match schema/other uses
    steamAppid: string | null;
    tags: string[] | null;
    rawData?: SteamRawData | null; // Add rawData prop (optional for now)
  };
  detailsLinkHref: string; // Add href prop for consistency
  isInLibrary: boolean;
  onAddToLibrary: (gameId: number) => Promise<any>;
  onRemoveFromLibrary: (gameId: number) => Promise<any>;
  className?: string;
  style?: React.CSSProperties; // Allow passing style
}

export function GameCard({
  game,
  detailsLinkHref,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
  className,
  style, // Added style prop
}: GameCardProps) {
  // Reuse handleAdd and handleRemove logic from GameCardMini
  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToLibrary) {
      try {
        await onAddToLibrary(game.id);
      } catch (error) {
        console.error("Error adding to library:", error);
      }
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemoveFromLibrary) {
      try {
        await onRemoveFromLibrary(game.id);
      } catch (error) {
        console.error("Error removing from library:", error);
      }
    }
  };

  const imageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null; // Set to null if no steamAppid to handle fallback better

  // Process rawData for MediaCarousel
  const rawData = game.rawData;
  const screenshots = rawData?.screenshots || [];
  const movies = rawData?.movies || [];
  const mediaItems: MediaItem[] = [
    ...movies.map(
      (movie: Movie): MediaItem => ({
        // Added explicit type for movie
        type: "video",
        data: movie,
      })
    ),
    ...screenshots.map(
      (screenshot: Screenshot): MediaItem => ({
        // Added explicit type for screenshot
        type: "image",
        data: screenshot,
      })
    ),
  ];

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden transition-shadow hover:shadow-lg w-full",
        "py-0 gap-0", // Added overrides similar to GameCardMini
        className
      )}
      style={style} // Added style prop
    >
      {/* Content: Tighter spacing applied via Card override + p-3 */}
      <CardContent className="p-3 flex-grow flex flex-col gap-2">
        <Link
          href={detailsLinkHref}
          className="block group shrink-0 rounded overflow-hidden relative bg-muted w-24 aspect-cover-art" // Adjusted size and aspect ratio
          aria-label={`View details for ${game.title || "Untitled Game"}`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={game.title ? `${game.title} Icon` : "Game Icon"}
              fill
              sizes="64px" // Size based on width 16 (w-16 = 4rem = 64px)
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-game.jpg"; // Fallback to general placeholder
                (e.target as HTMLImageElement).classList.add("opacity-50"); // Indicate placeholder visually
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageOff className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </Link>
        <div className="flex-grow min-w-0">
          <Link href={detailsLinkHref} className="block group">
            <h3
              className="text-base sm:text-lg font-semibold truncate group-hover:text-primary transition-colors"
              title={game.title || "Untitled Game"}
            >
              {game.title || "Untitled Game"}
            </h3>
          </Link>
          {/* Could add a subtitle here if needed, e.g., a primary genre or developer */}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
          {game.shortDescription || "No description available."}
        </p>

        {game.tags && game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {game.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {game.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{game.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Media Carousel */}
        {mediaItems.length > 0 ? (
          <div className="mt-1 rounded-md overflow-hidden">
            {" "}
            {/* Added overflow-hidden */}
            <MediaCarousel
              mediaItems={mediaItems}
              gameTitle={game.title || ""}
            />
          </div>
        ) : (
          // Optional: Show static header image if no media items and header image exists
          imageUrl && (
            <Link
              href={detailsLinkHref}
              className="block group aspect-[460/215] rounded-md overflow-hidden relative bg-muted mt-1"
              aria-label={`View details for ${game.title || "Untitled Game"}`}
            >
              <Image
                src={imageUrl}
                alt={
                  game.title
                    ? `${game.title} Header Image`
                    : "Game Header Image"
                }
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                onError={(e) => {
                  // Simplified fallback - just hide the image container on error
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) parent.style.display = "none";
                }}
              />
            </Link>
          )
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
      </CardFooter>
    </Card>
  );
}
