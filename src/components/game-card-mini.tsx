"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BookmarkPlus, BookmarkCheck, Eye, Bookmark } from "lucide-react";
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type
import { GameImage } from "./game-image"; // Import the reusable GameImage component
import { Badge } from "@/components/ui/badge";

interface GameCardMiniProps {
  game: {
    id: number;
    title: string | null;
    steamAppid: string | null;
    descriptionShort?: string | null;
    rawData?: SteamRawData | null; // rawData prop is already here
    // header_image is not directly on game object, but derived or part of rawData in externalSourceTable
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
    <Link href={detailsLinkHref} className="block h-full">
      <Card
        className={cn(
          "h-full flex flex-col overflow-hidden transition-shadow hover:shadow-lg",
          "py-0 gap-0 cursor-pointer", // Add cursor-pointer to indicate clickability
          className
        )}
      >
        <GameImage
          altText={altText}
          gameData={game.rawData ?? null}
          sizes={imageSizes}
          variant="plain"
        />
        <CardContent className="p-3 flex-grow flex flex-col">
          <h3
            className="text-base font-semibold line-clamp-1 hover:text-primary transition-colors"
            title={game.title || "Unknown Game"}
          >
            {game.title || "Unknown Game"}
          </h3>
          {game.descriptionShort && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-grow">
              {game.descriptionShort}
            </p>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-2 flex items-center gap-2">
          {onAddToLibrary && onRemoveFromLibrary && (
            <Button
              variant={isInLibrary ? "secondary" : "default"}
              size="sm"
              onClick={isInLibrary ? handleRemove : handleAdd}
              title={isInLibrary ? "Remove from Library" : "Add to Library"}
              className="flex-1 flex items-center justify-center gap-1"
            >
              {isInLibrary ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {isInLibrary ? "Saved" : "Save"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
