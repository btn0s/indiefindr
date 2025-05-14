"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  BookmarkPlus,
  BookmarkCheck,
  Eye,
  Bookmark,
  XCircle,
} from "lucide-react";
import type { SteamRawData } from "@/types/steam"; // Keep for backward compatibility
import type { GameListItemViewModel } from "@/types/game-models"; // Import the new view model type
import { GameImage } from "./game-image"; // Import the reusable GameImage component
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClaimFindButton } from "@/components/claim-find-button"; // Import ClaimFindButton
import { getUserInitials } from "@/utils/date-utils"; // Import from utils

interface GameCardMiniProps {
  game: GameListItemViewModel | {
    id: number;
    title: string | null;
    steamAppid: string | null;
    descriptionShort?: string | null;
    rawData?: SteamRawData | null;
    foundByUsername?: string | null;
    foundByAvatarUrl?: string | null;
  };
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

  // Handle legacy game object format
  const isLegacyFormat = 'descriptionShort' in game || 'steamAppid' in game;
  
  // Extract data based on format
  const id = game.id;
  const title = game.title;
  const description = isLegacyFormat 
    ? (game as any).descriptionShort 
    : game.description;
  const steamAppId = isLegacyFormat 
    ? (game as any).steamAppid 
    : game.steamAppId;
  const rawData = isLegacyFormat 
    ? (game as any).rawData 
    : null;

  const altText = title
    ? `${title} header image`
    : "Game header image";
  const imageSizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw";

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if card is wrapped in Link
    e.stopPropagation();
    if (onAddToLibrary) {
      try {
        await onAddToLibrary(id);
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
        await onRemoveFromLibrary(id);
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
            gameData={rawData ?? null}
            sizes={imageSizes}
            variant="plain"
          />
          <CardContent className="p-3 flex-grow flex flex-col">
            <h3
              className="text-base font-semibold line-clamp-1 hover:text-primary transition-colors"
              title={title || "Unknown Game"}
            >
              {title || "Unknown Game"}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-grow">
                {description}
              </p>
            )}
          </CardContent>
          <CardFooter className="p-3 pt-2 flex items-center gap-2">
            {isSteamOnlyResult ? (
              currentUserId && steamAppId && title ? (
                <ClaimFindButton
                  appid={parseInt(steamAppId, 10)} // Ensure appid is a number
                  name={title}
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
