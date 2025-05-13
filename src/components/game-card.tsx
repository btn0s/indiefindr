"use client";

import React, { useRef, useEffect } from "react";
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
import {
  BookmarkPlus,
  BookmarkCheck,
  Eye,
  ImageOff,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { MediaCarousel } from "@/components/media-carousel"; // Import MediaCarousel
import type { MediaItem, SteamRawData, Movie, Screenshot } from "@/types/steam"; // Updated import path
import { toast } from "sonner";

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
  style,
}: GameCardProps) {
  const [hasCopied, setHasCopied] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const imageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null; // Set to null if no steamAppid to handle fallback better

  // Get the first video or screenshot from rawData
  const rawData = game.rawData;
  const firstVideo = rawData?.movies?.[0];
  const firstScreenshot = rawData?.screenshots?.[0];

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
        <CardContent className="p-3 flex flex-col gap-2">
          {/* Two column layout */}
          <div className="flex gap-4">
            {/* Left column: Title and description */}
            <div className="w-full flex flex-col justify-between flex-1">
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

            {/* Right column: Image */}
            <div className="w-64 border-white/20 border flex-none rounded overflow-hidden relative bg-muted aspect-cover-art">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={game.title ? `${game.title} Icon` : "Game Icon"}
                  fill
                  sizes="96px"
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/placeholder-game.jpg";
                    (e.target as HTMLImageElement).classList.add("opacity-50");
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Media Preview */}
          {firstVideo ? (
            <div className="mt-1 rounded-md overflow-hidden aspect-video relative bg-black">
              <video
                ref={videoRef}
                src={firstVideo.mp4.max}
                poster={firstVideo.thumbnail}
                muted
                playsInline
                loop
                className="w-full h-full object-contain"
              />
            </div>
          ) : firstScreenshot ? (
            <div className="mt-1 rounded-md overflow-hidden aspect-video relative bg-black">
              <Image
                src={firstScreenshot.path_full}
                alt={
                  game.title ? `${game.title} Screenshot` : "Game Screenshot"
                }
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                className="object-contain"
              />
            </div>
          ) : imageUrl ? (
            <div className="mt-1 rounded-md overflow-hidden aspect-video relative bg-black">
              <Image
                src={imageUrl}
                alt={game.title ? `${game.title} Header` : "Game Header"}
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 30vw"
                className="object-contain"
              />
            </div>
          ) : null}
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
