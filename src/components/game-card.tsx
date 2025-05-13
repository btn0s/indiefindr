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
import { BookmarkPlus, BookmarkCheck, Eye } from "lucide-react";

interface GameCardProps {
  game: {
    id: number;
    title: string | null;
    shortDescription: string | null; // Renamed to match schema/other uses
    steamAppid: string | null;
    tags: string[] | null;
  };
  detailsLinkHref: string; // Add href prop for consistency
  isInLibrary: boolean;
  onAddToLibrary: (gameId: number) => Promise<any>;
  onRemoveFromLibrary: (gameId: number) => Promise<any>;
  className?: string;
}

export function GameCard({
  game,
  detailsLinkHref,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
  className,
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
    : "/placeholder-game.jpg"; // Ensure placeholder exists

  return (
    <Card
      className={cn(
        "flex flex-col sm:flex-row items-start gap-4 overflow-hidden transition-shadow hover:shadow-lg",
        "p-3 sm:p-4", // Override default padding, slightly different for mobile/desktop
        "gap-3 sm:gap-4", // Override default gap
        className
      )}
    >
      {/* Image container - slightly adjusted classes */}
      <Link
        href={detailsLinkHref}
        className="block group shrink-0 w-full sm:w-1/3 aspect-[460/215] rounded overflow-hidden relative bg-muted"
      >
        <Image
          src={imageUrl}
          alt={game.title ? `${game.title} Header Image` : "Game Header Image"}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 30vw, 20vw"
          className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder-game.jpg";
          }}
        />
      </Link>

      {/* Content Area - Takes remaining space */}
      <div className="flex-grow flex flex-col min-w-0 px-1 sm:px-0">
        {" "}
        {/* Added padding override for mobile */}
        {/* Use CardContent for main text and tags, remove internal padding */}
        <CardContent className="p-0 flex-grow flex flex-col gap-1">
          <Link href={detailsLinkHref} className="block group">
            <h3
              className="text-lg font-semibold truncate group-hover:text-primary transition-colors"
              title={game.title || "Untitled Game"}
            >
              {game.title || "Untitled Game"}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
            {game.shortDescription || "No description."}
          </p>
          {/* Tags Display */}
          {game.tags && game.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
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
        </CardContent>
        {/* Use CardFooter for actions, remove internal padding */}
        <CardFooter className="p-0 pt-2 flex items-center gap-2">
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
      </div>
    </Card>
  );
}
