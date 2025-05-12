"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface GameCardProps {
  game: {
    id: number;
    title: string | null;
    shortDescription: string | null;
    steamAppid: string | null;
    tags: string[] | null;
  };
  isInLibrary: boolean;
  onAddToLibrary: (gameId: number) => Promise<any>;
  onRemoveFromLibrary: (gameId: number) => Promise<any>;
}

export function GameCard({
  game,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
}: GameCardProps) {
  const handleAdd = async () => {
    try {
      await onAddToLibrary(game.id);
    } catch (error) {
      console.error("Error adding to library:", error);
    }
  };

  const handleRemove = async () => {
    try {
      await onRemoveFromLibrary(game.id);
    } catch (error) {
      console.error("Error removing from library:", error);
    }
  };

  const imageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null; // Or a placeholder image URL

  return (
    // Main container: Flex row, align items start
    <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      {/* Image container */}
      <div className="shrink-0 w-full sm:w-1/2 sm:max-w-1/2 aspect-cover-art rounded bg-foreground/50 overflow-hidden border relative">
        {/* Slightly larger image */}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={
              game.title ? `${game.title} Header Image` : "Game Header Image"
            }
            fill
            sizes="128px" // Image width
            className="object-cover"
          />
        ) : (
          // Placeholder if no image
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No Image</span>
          </div>
        )}
      </div>

      {/* Center Content container (Vertical Stack) */}
      <div className="flex-grow flex flex-col gap-1 min-w-0">
        {" "}
        {/* Ensure takes available space */}
        <p className="text-lg font-semibold truncate">
          {game.title || "Untitled Game"}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {" "}
          {/* Allow 3 lines, changed from line-clamp-2 */}
          {game.shortDescription || "No description."}
        </p>
        {/* Tags Display */}
        {game.tags && game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {game.tags.slice(0, 3).map(
              (
                tag // Limit displayed tags to 3
              ) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              )
            )}
            {game.tags.length > 3 && ( // Check if more than 3 tags exist
              <Badge variant="outline">+{game.tags.length - 3} more</Badge> // Adjust count
            )}
          </div>
        )}
        {/* Add Actions within the content flow */}
        <div className="flex items-center gap-2 mt-2">
          {" "}
          {/* Wrapper for buttons */}
          <Link
            href={`/game/${game.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))} // Removed w-full
            title="View Details"
          >
            Details
          </Link>
          <Button
            variant="default"
            size="sm"
            onClick={handleAdd}
            title="Add to Library"
            disabled={isInLibrary}
          >
            {isInLibrary ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
