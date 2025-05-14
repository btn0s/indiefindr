"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SteamRawData } from "@/types/steam"; // Keep for backward compatibility
import type { GameCardViewModel } from "@/types/game-models"; // Import the new view model type
import { useLibrary } from "@/contexts/LibraryContext"; // Import the hook
import { GameImage } from "./game-image"; // Import the reusable GameImage component
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Bookmark, BookmarkCheck, ImageOff, Share2, Check } from "lucide-react";
import { ensureHttps } from "@/lib/utils"; // Import the ensureHttps helper
import { formatTimeAgo, getUserInitials } from "@/utils/date-utils"; // Import from utils

// For backward compatibility with existing code
interface GameCardProps {
  game: GameCardViewModel | {
    id: number;
    title: string | null;
    shortDescription: string | null; 
    steamAppid: string | null;
    tags: string[] | null;
    rawData?: SteamRawData | null;
    foundByUsername?: string | null;
    foundByAvatarUrl?: string | null;
    createdAt?: string | Date | null;
  };
  detailsLinkHref: string;
  className?: string;
  style?: React.CSSProperties;
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

  // Handle legacy game object format
  const isLegacyFormat = 'shortDescription' in game;
  
  // Extract data based on format
  const title = isLegacyFormat ? game.title : game.title;
  const description = isLegacyFormat ? game.shortDescription : game.description;
  const tags = isLegacyFormat ? game.tags : game.tags;
  const rawData = isLegacyFormat ? game.rawData : null;
  
  // Extract foundBy information
  const foundByUsername = isLegacyFormat 
    ? game.foundByUsername || "IndieFindr"
    : game.foundBy.username || "IndieFindr";
    
  const foundByAvatarUrl = isLegacyFormat
    ? game.foundByAvatarUrl || "/images/avatar.png"
    : game.foundBy.avatarUrl || "/images/avatar.png";
    
  const createdAt = isLegacyFormat
    ? game.createdAt
    : game.foundBy.timestamp;

  // Extract media preview
  const mediaPreview = isLegacyFormat
    ? null // Legacy format doesn't have mediaPreview
    : game.mediaPreview;

  // For legacy format, use the old way of determining media
  const firstVideo = isLegacyFormat ? rawData?.movies?.[0] : null;
  const firstScreenshot = isLegacyFormat ? rawData?.screenshots?.[0] : null;
  const imageUrlFromSteam = isLegacyFormat && game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;

  const handleMediaError = () => {
    setMediaError(true);
  };

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
        title: title || "Check out this game",
        text: `Check out ${title || "this game"} on IndieFindr!`,
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
    <div className="flex flex-col gap-2">
      {/* User attribution - moved outside the card */}

      <div className="flex justify-between">
        <Link
          href={`/user/${foundByUsername}`}
          className={cn("flex items-center gap-2 px-1", {
            "pointer-events-none": foundByUsername === "IndieFindr",
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
              found this {formatTimeAgo(createdAt)}
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
              ) : !isLegacyFormat && mediaPreview ? (
                // New format with mediaPreview
                mediaPreview.type === "video" ? (
                  <video
                    ref={videoRef}
                    key={mediaPreview.url || ""}
                    src={mediaPreview.url || ""}
                    poster={mediaPreview.thumbnailUrl || ""}
                    muted
                    playsInline
                    loop
                    controls={false}
                    className="w-full h-full object-contain"
                    onError={handleMediaError}
                  />
                ) : mediaPreview.type === "image" ? (
                  <Image
                    key={mediaPreview.url || ""}
                    src={mediaPreview.url || ""}
                    alt={title ? `${title} Screenshot` : "Game Screenshot"}
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
                )
              ) : firstVideo ? (
                // Legacy format with video
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
                // Legacy format with screenshot
                <Image
                  key={firstScreenshot.path_full}
                  src={ensureHttps(firstScreenshot.path_full) || ""}
                  alt={
                    title ? `${title} Screenshot` : "Game Screenshot"
                  }
                  fill
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                  className="object-contain"
                  onError={handleMediaError}
                  unoptimized
                />
              ) : imageUrlFromSteam ? (
                // Legacy format with Steam header
                <Image
                  key={imageUrlFromSteam}
                  src={imageUrlFromSteam || ""}
                  alt={title ? `${title} Header` : "Game Header"}
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
                    title={title || "Untitled Game"}
                  >
                    {title || "Untitled Game"}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                    {description || "No description available."}
                  </p>

                  {/* Removed user attribution from here */}
                </div>

                {tags && tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="w-1/3">
                <GameImage
                  altText={title ? `${title} Header` : "Game Header"}
                  gameData={rawData ?? null}
                  sizes="150px"
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
