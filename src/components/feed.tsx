"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { GameCard } from "@/components/game-card";
import { AlertCircle, Loader2 } from "lucide-react";
import { getGameUrl } from "@/utils/game-url";
import type { SteamRawData } from "@/types/steam";

// Consistent type for game data from API responses
interface ApiGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

interface FeedDisplayProps {
  isLoggedIn: boolean;
}

export function Feed({ isLoggedIn }: FeedDisplayProps) {
  const [games, setGames] = useState<ApiGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Using a ref to ensure fetchFeed is not re-created unnecessarily
  // if we later add dependencies to its useCallback that change often.
  const observer = useRef<IntersectionObserver | null>(null);

  const fetchFeed = useCallback(
    async (currentPage: number) => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: Add query parameter for pagination (e.g., ?page=${currentPage})
        // For now, /api/feed and /api/games/recent don't support pagination yet
        const endpoint = isLoggedIn ? `/api/feed` : `/api/games/recent`;
        const response = await fetch(endpoint);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Failed to fetch data." }));
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        const result = await response.json();

        if (result.success && result.data) {
          setGames((prevGames) =>
            currentPage === 1 ? result.data : [...prevGames, ...result.data]
          );
          // TODO: Update hasMore based on API response (e.g., if result.data.length < PAGE_SIZE)
          // For now, assume one page fetch, so no more after the first successful fetch.
          setHasMore(false);
        } else {
          setError(result.message || "Could not load games.");
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Fetch feed error:", err);
        setError(err.message || "An unexpected error occurred.");
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoggedIn]
  ); // Re-create if isLoggedIn changes (e.g., user logs in/out)

  useEffect(() => {
    // Fetch initial feed data
    fetchFeed(1);
  }, [fetchFeed]); // Rerun when fetchFeed (and thus isLoggedIn) changes

  // Placeholder for the last game element to trigger infinite scroll
  const lastGameElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1); // This will trigger the useEffect below
        }
      });

      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore]
  );

  useEffect(() => {
    if (page > 1 && hasMore) {
      // Only fetch if page increased and there's more data
      fetchFeed(page);
    }
  }, [page, hasMore, fetchFeed]);

  if (isLoading && games.length === 0) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading games...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <div>
          <p className="font-semibold">Could not load game data:</p>
          <p className="text-sm">- {error}</p>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center">
        {isLoggedIn
          ? "Your feed is empty. Add games to your library for recommendations!"
          : "No recent games found."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {games.map((game, index) => {
        const detailsLinkHref = getGameUrl(game.id, game.title);
        if (games.length === index + 1) {
          // Attach ref to the last element for infinite scroll detection
          return (
            <div ref={lastGameElementRef} key={game.id}>
              <GameCard game={game} detailsLinkHref={detailsLinkHref} />
            </div>
          );
        }
        return (
          <GameCard
            key={game.id}
            game={game}
            detailsLinkHref={detailsLinkHref}
          />
        );
      })}
      {isLoading && games.length > 0 && (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading more games...</p>
        </div>
      )}
      {!isLoading && !hasMore && games.length > 0 && (
        <p className="text-muted-foreground text-center py-6">
          You've reached the end!
        </p>
      )}
    </div>
  );
}
