"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookmarkCheck, Bookmark, XCircle } from "lucide-react";
import { GameImage } from "./game-image"; // Import the reusable GameImage componen
import { ClaimFindButton } from "@/components/claim-find-button"; // Import ClaimFindButton
import { GameCardViewModel } from "@/services/game-service";

interface GameCardMiniProps {
  game: GameCardViewModel;
  detailsLinkHref: string;
  isInLibrary?: boolean;
  onAddToLibrary?: (gameId: number) => Promise<any>;
  onRemoveFromLibrary?: (gameId: number) => Promise<any>;
  className?: string;
  isSteamOnlyResult?: boolean; // New prop for Steam-only items
  currentUserId?: string | null; // New prop for user ID
}

export function GameCardMini({
  game,
  detailsLinkHref,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
  className,
  isSteamOnlyResult,
  currentUserId,
}: GameCardMiniProps) {
  const [isHoveringRemove, setIsHoveringRemove] = useState(false);
  // Add state to track avatar image loading errors
  const [avatarError, setAvatarError] = useState(false);

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
    <div className="flex flex-col gap-2">
      {/* Removed user attribution section */}

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
            gameData={{
              // Construct the expected SteamRawData shape for GameImage
              // using available URLs from GameCardViewModel
              header_image: game.headerImageUrl,
              capsule_image: game.coverImageUrl, // GameImage might use this or header_image
              // GameImage primarily uses header_image and screenshots array.
              // Provide a mock screenshots array if GameImage depends on it.
              screenshots: game.headerImageUrl
                ? [
                    {
                      id: 0,
                      path_full: game.headerImageUrl,
                      path_thumbnail: game.headerImageUrl,
                    },
                  ]
                : game.coverImageUrl // <-- If no header, try cover for screenshot
                  ? [
                      {
                        id: 0,
                        path_full: game.coverImageUrl,
                        path_thumbnail: game.coverImageUrl,
                      },
                    ]
                  : [],
              // Add any other fields from SteamRawData that GameImage might try to access, as undefined or null.
              movies: [], // Example if GameImage ever looks at movies
            }}
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
            {game.shortDescription && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-grow">
                {game.shortDescription}
              </p>
            )}
          </CardContent>
          <CardFooter className="p-3 pt-2 flex items-center gap-2">
            {isSteamOnlyResult ? (
              currentUserId && game.steamAppid && game.title ? (
                <ClaimFindButton
                  appid={parseInt(game.steamAppid, 10)} // Ensure appid is a number
                  name={game.title}
                  userId={currentUserId}
                />
              ) : (
                <Button variant="outline" size="sm" className="flex-1" disabled>
                  View on Steam
                </Button>
              )
            ) : onAddToLibrary && onRemoveFromLibrary ? (
              <Button
                variant={
                  isInLibrary
                    ? isHoveringRemove
                      ? "destructive"
                      : "secondary"
                    : "default"
                }
                size="sm"
                onClick={isInLibrary ? handleRemove : handleAdd}
                title={isInLibrary ? "Remove from Library" : "Add to Library"}
                className="flex-1 flex items-center justify-center gap-1"
                onMouseEnter={() => isInLibrary && setIsHoveringRemove(true)}
                onMouseLeave={() => setIsHoveringRemove(false)}
              >
                {isInLibrary ? (
                  isHoveringRemove ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  )
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {isInLibrary ? (isHoveringRemove ? "Remove" : "Saved") : "Save"}
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </Link>
    </div>
  );
}
