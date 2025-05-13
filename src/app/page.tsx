import React from "react";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { AlertCircle } from "lucide-react";
import {
  addToLibrary,
  removeFromLibrary,
  getLibraryGameIds,
} from "@/app/actions/library";
import { getPersonalizedFeed } from "@/app/actions/feed"; // Import the feed action
import { getRecentGames } from "@/app/actions/games"; // Import the recent games action
import { createClient } from "@/utils/supabase/server";
import { getGameUrl } from "@/utils/game-url"; // Import the utility function
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type

// Define the shared shape of game data for both feed and recent games
interface DisplayGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let games: DisplayGame[] = [];
  let gameError: string | null = null;
  let libraryGameIds = new Set<number>();
  let libraryError: string | null = null;

  if (user) {
    // Logged-in user: Fetch personalized feed and library
    const feedResultPromise = getPersonalizedFeed();
    const libraryResultPromise = getLibraryGameIds();

    const [feedResult, libraryResult] = await Promise.all([
      feedResultPromise,
      libraryResultPromise,
    ]);

    // Process feed results
    if (feedResult.success && feedResult.data) {
      games = feedResult.data;
    } else if (!feedResult.success) {
      gameError = feedResult.message || "Failed to load personalized feed.";
      console.error("Feed Error:", gameError);
    }

    // Process library results
    if (libraryResult.success && libraryResult.data) {
      libraryGameIds = new Set(libraryResult.data);
    } else if (!libraryResult.success) {
      libraryError = libraryResult.error || "Failed to load user library.";
      console.error("Library Error:", libraryError);
      // Note: If library fails, feed might still work, but isInLibrary will be false.
    }
  } else {
    // Logged-out user: Fetch recent games
    const recentGamesResult = await getRecentGames();

    if (recentGamesResult.success && recentGamesResult.data) {
      games = recentGamesResult.data;
    } else if (!recentGamesResult.success) {
      gameError = recentGamesResult.message || "Failed to load recent games.";
      console.error("Recent Games Error:", gameError);
    }
    // No library data for logged-out users
    libraryGameIds = new Set<number>();
  }

  const hasError = gameError || libraryError;
  const showEmptyMessage = !gameError && games.length === 0;

  return (
    <main className="">
      {/* Error Display */}
      {hasError && (
        <div className="mb-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Could not load all data:</p>
            {gameError && <p className="text-sm">- Games: {gameError}</p>}
            {libraryError && (
              <p className="text-sm">- Library: {libraryError}</p>
            )}
          </div>
        </div>
      )}
      {/* Content: Empty Message or Game List */}
      {showEmptyMessage ? (
        <p className="text-muted-foreground">
          {user
            ? "Your feed is empty. Add games to your library for recommendations!"
            : "No recent games found."}
        </p>
      ) : !gameError ? ( // Only show games if there wasn't a game fetch error
        <div className="flex flex-col gap-4">
          {games.map((game) => {
            const detailsLinkHref = getGameUrl(game.id, game.title);
            return (
              <GameCard
                key={game.id}
                game={game} // Pass the whole game object
                detailsLinkHref={detailsLinkHref}
                isInLibrary={libraryGameIds.has(game.id)}
                // Only pass library actions if the user is logged in
                onAddToLibrary={user ? addToLibrary : undefined}
                onRemoveFromLibrary={user ? removeFromLibrary : undefined}
              />
            );
          })}
        </div>
      ) : null}{" "}
      {/* Don't show anything if gameError is present */}
    </main>
  );
}
