"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SteamRawData } from "@/types/steam"; // Updated import path
import { useLibrary } from "@/contexts/LibraryContext"; // Import the hook
import { GameImage } from "./game-image"; // Import the reusable GameImage component
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Bookmark, BookmarkCheck, ImageOff, Share2, Check } from "lucide-react";
import { ensureHttps } from "@/lib/utils"; // Import the ensureHttps helper

// Helper function to get user initials for avatar fallback
const getUserInitials = (name?: string | null) => {
  if (!name) return "IF"; // Return "IF" for IndieFindr when no name is available
  return name.charAt(0).toUpperCase();
};

// Helper function to format time ago
const formatTimeAgo = (dateInput?: string | Date | null): string => {
  if (!dateInput) return "Date not available";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30.44); // Average days in month
  const years = Math.round(days / 365.25); // Account for leap years

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`; // Up to 4 weeks
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
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
    createdAt?: string | Date | null; // <--- Add this line
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
  const [avatarError, setAvatarError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Log the received game prop, especially foundBy fields
  console.log(
    "GameCard received game:",
    game,
    "FoundByUsername:",
    game.foundByUsername,
    "FoundByAvatarUrl:",
    game.foundByAvatarUrl
  );

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
  const imageUrlFromSteam = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;
  const rawData = game.rawData;

  // Ensure all potential URLs are HTTPS
  const secureImageUrl = ensureHttps(imageUrlFromSteam);
  const secureCapsuleImage = ensureHttps(rawData?.capsule_image);
  const secureCapsuleImageV5 = ensureHttps(rawData?.capsule_imagev5);
  const secureScreenshotPathFull = ensureHttps(
    rawData?.screenshots?.[0]?.path_full
  );
  const secureBackgroundRaw = ensureHttps(rawData?.background_raw);
  const secureBackground = ensureHttps(rawData?.background);

  const potentialCoverUrls = [
    secureImageUrl,
    secureCapsuleImage,
    secureCapsuleImageV5,
    secureScreenshotPathFull,
    secureBackgroundRaw,
    secureBackground,
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

  const foundByUsername = game.foundByUsername || "IndieFindr";
  const foundByAvatarUrl = game.foundByAvatarUrl || "/images/avatar.png";

  return (
    <div className="flex flex-col gap-2">
      {/* User attribution - moved outside the card */}

      <div className="flex justify-between">
        <Link
          href={`/user/${foundByUsername}`}
          className={cn("flex items-center gap-2 px-1", {
            "pointer-events-none": !game.foundByUsername,
          })}
        >
          <Avatar className="size-8 shrink-0 ring-1 ring-foreground/20 border border-background/60">
            <AvatarImage
              src={ensureHttps(foundByAvatarUrl) || undefined}
              alt={`${foundByUsername}'s avatar`}
              onError={() => setAvatarError(true)}
              style={{ display: avatarError ? "none" : "block" }}
            />
            <AvatarFallback className="text-xs">
              {getUserInitials(foundByUsername)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-lg leading-none">
              {foundByUsername}
            </span>
            <span className="text-xs text-muted-foreground leading-none">
              found this {formatTimeAgo(game.createdAt)}
            </span>
          </div>
        </Link>
      </div>

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
                  src={ensureHttps(firstVideo.mp4.max) || ""}
                  poster={ensureHttps(firstVideo.thumbnail) || ""}
                  muted
                  playsInline
                  loop
                  controls={false}
                  className="w-full h-full object-contain"
                  onError={handleMediaError}
                />
              ) : firstScreenshot ? (
                <Image
                  key={firstScreenshot.path_full}
                  src={ensureHttps(firstScreenshot.path_full) || ""}
                  alt={
                    game.title ? `${game.title} Screenshot` : "Game Screenshot"
                  }
                  fill
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                  className="object-contain"
                  onError={handleMediaError}
                  unoptimized
                />
              ) : secureImageUrl ? (
                <Image
                  key={secureImageUrl}
                  src={secureImageUrl || ""}
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

                  {/* Removed user attribution from here */}
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
            onClick={isInLibrary ? handleRemove : handleAdd}
            disabled={isLibraryLoading}
            className="flex-1"
          >
            {isInLibrary ? (
              <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Bookmark className="mr-1.5 h-3.5 w-3.5" />
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
    </div>
  );
}
