"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaCarousel } from "@/components/media-carousel"; // Import MediaCarousel
import type { MediaItem, SteamRawData, Movie, Screenshot } from "@/types/steam"; // Updated import path
import { toast } from "sonner";
import { useLibrary } from "@/contexts/LibraryContext"; // Import the hook
import { GameImage } from "./game-image"; // Import the reusable GameImage component

// Helper function to get user initials for avatar fallback
const getUserInitials = (name?: string | null) => {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
};

interface GameCardProps {
  game: {
    id: number;
    title: string | null;
    shortDescription: string | null; // Renamed to match schema/other uses
    steamAppid: string | null;
    tags: string[] | null;
    rawData?: SteamRawData | null; // Add rawData prop (optional for now)
    foundByUsername?: string | null; // Add foundByUsername to game type
    foundByAvatarUrl?: string | null; // Add foundByAvatarUrl to game type
  };
  detailsLinkHref: string; // Add href prop for consistency
  className?: string;
  style?: React.CSSProperties; // Allow passing style
}

export function GameCard({
  game,
  detailsLinkHref,
  className,
  style,
}: GameCardProps) {
  const [hasCopied, setHasCopied] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);
  const [mediaError, setMediaError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use the library context
  const {
    isGameInLibrary,
    addToLibrary: addToLibraryCtx,
    removeFromLibrary: removeFromLibraryCtx,
    isLoading: isLibraryLoading,
  } = useLibrary();

  const isInLibrary = isGameInLibrary(game.id);

  // Reset media error state (only)
  useEffect(() => {
    setMediaError(false);
  }, [game.id]);

  // Check if sharing is available
  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  // Set up intersection observer for video autoplay
  useEffect(() => {
    if (!videoRef.current || !cardRef.current) return;

    const video = videoRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Autoplay may be blocked, that's okay
            });
          } else {
            video.pause();
          }
        });
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.5, // When 50% of the card is visible
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
      video.pause();
    };
  }, []);

  // Define potential cover art URLs (keep this)
  const imageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;
  const rawData = game.rawData;
  const potentialCoverUrls = [
    imageUrl, // 1. header.jpg
    rawData?.capsule_image, // 2. capsule_image (medium)
    rawData?.capsule_imagev5, // 3. capsule_imagev5 (small)
    rawData?.screenshots?.[0]?.path_full, // 4. First full screenshot
    rawData?.background_raw, // 5. Raw background
    rawData?.background, // 6. Processed background
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  // Get the first video or screenshot for the main media preview (keep this)
  const firstVideo = rawData?.movies?.[0];
  const firstScreenshot = rawData?.screenshots?.[0];

  const handleMediaError = () => {
    setMediaError(true);
  };

  // Define props for the GameImage cover art
  const coverAltText = game.title
    ? `${game.title} Cover Art`
    : "Game Cover Art";
  const coverImageSizes = "150px"; // Specific size for the small cover art

  // Update handleAdd and handleRemove to use context functions
  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addToLibraryCtx(game.id);
    } catch (error) {
      console.error("Error adding to library (handled by context):", error);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await removeFromLibraryCtx(game.id);
    } catch (error) {
      console.error("Error removing from library (handled by context):", error);
    }
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = window.location.origin + detailsLinkHref;

    try {
      await navigator.share({
        title: game.title || "Check out this game",
        text: `Check out ${game.title || "this game"} on IndieFindr!`,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = window.location.origin + detailsLinkHref;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  return (
    <Card
      ref={cardRef}
      className={cn(
        "flex flex-col overflow-hidden transition-shadow hover:shadow-lg w-full group/card",
        "py-0 gap-0",
        className
      )}
      style={style}
    >
      <Link href={detailsLinkHref} className="flex-grow">
        <CardContent className="p-3 flex flex-col gap-4">
          {/* Media Preview */}
          <div className="rounded-md overflow-hidden aspect-video relative bg-black flex items-center justify-center border">
            {mediaError ? (
              <div className="text-muted-foreground flex flex-col items-center gap-1">
                <ImageOff className="h-8 w-8" />
                <span className="text-xs">Preview unavailable</span>
              </div>
            ) : firstVideo ? (
              <video
                ref={videoRef}
                key={firstVideo.mp4.max}
                src={firstVideo.mp4.max}
                poster={firstVideo.thumbnail}
                muted
                playsInline
                loop
                className="w-full h-full object-contain"
                onError={handleMediaError}
              />
            ) : firstScreenshot ? (
              <Image
                key={firstScreenshot.path_full}
                src={firstScreenshot.path_full}
                alt={
                  game.title ? `${game.title} Screenshot` : "Game Screenshot"
                }
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                className="object-contain"
                onError={handleMediaError}
                unoptimized
              />
            ) : imageUrl ? (
              <Image
                key={imageUrl}
                src={imageUrl}
                alt={game.title ? `${game.title} Header` : "Game Header"}
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                className="object-contain"
                onError={handleMediaError}
                unoptimized
              />
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-1">
                <ImageOff className="h-8 w-8" />
                <span className="text-xs">No preview</span>
              </div>
            )}
          </div>

          {/* Two column layout */}
          <div className="flex gap-4">
            <div className="flex flex-col justify-between w-2/3 gap-4">
              <div>
                <h3
                  className="text-base sm:text-lg font-semibold truncate group-hover/card:text-primary transition-colors"
                  title={game.title || "Untitled Game"}
                >
                  {game.title || "Untitled Game"}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                  {game.shortDescription || "No description available."}
                </p>
                
                {/* User who found the game */}
                {game.foundByUsername && (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={game.foundByAvatarUrl ?? undefined}
                        alt={`${game.foundByUsername}'s avatar`}
                      />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(game.foundByUsername)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Found by <span className="font-medium">{game.foundByUsername}</span>
                    </span>
                  </div>
                )}
              </div>

              {game.tags && game.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto">
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
            </div>
            <div className="w-1/3">
              <GameImage
                altText={coverAltText}
                gameData={rawData ?? null}
                sizes={coverImageSizes}
              />
            </div>
          </div>
        </CardContent>
      </Link>

      <CardFooter className="p-3 pt-2 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = detailsLinkHref;
          }}
          className="flex-1"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Details
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={isInLibrary ? handleRemove : handleAdd}
          disabled={isLibraryLoading}
          className="flex-1"
        >
          {isInLibrary ? (
            <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
          )}
          {isInLibrary ? "Saved" : "Save"}
        </Button>
        {/* Mobile/Touch Share Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNativeShare}
          className="flex-1 md:hidden"
        >
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share
        </Button>
        {/* Desktop Copy Link Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          className="flex-1 hidden md:flex"
        >
          {hasCopied ? (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {hasCopied ? "Link copied!" : "Share"}
        </Button>
      </CardFooter>
    </Card>
  );
}
