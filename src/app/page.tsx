import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, AlertCircle } from "lucide-react";
import {
  addToLibrary,
  removeFromLibrary,
  getLibraryGameIds,
} from "@/app/actions/library";
import { getPersonalizedFeed } from "@/app/actions/feed"; // Import the feed action
import { createClient } from "@/utils/supabase/server";

// Define the expected shape of game data from the feed
// This should ideally match FeedGame interface in feed.ts
interface FeedGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null; // Add steamAppid
  tags: string[] | null; // Add tags array
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to sign-in page if not logged in
    redirect("/sign-in");
  }

  // Fetch feed and library data concurrently
  const feedResultPromise = getPersonalizedFeed();
  const libraryResultPromise = getLibraryGameIds();

  const [feedResult, libraryResult] = await Promise.all([
    feedResultPromise,
    libraryResultPromise,
  ]);

  // Process feed results
  let feedGames: FeedGame[] = [];
  let feedError: string | null = null;
  if (feedResult.success && feedResult.data) {
    feedGames = feedResult.data;
  } else if (!feedResult.success) {
    feedError = feedResult.message || "Failed to load personalized feed.";
    console.error("Feed Error:", feedError);
  }

  // Process library results
  let libraryGameIds = new Set<number>();
  let libraryError: string | null = null;
  if (libraryResult.success && libraryResult.data) {
    libraryGameIds = new Set(libraryResult.data);
  } else if (!libraryResult.success) {
    libraryError = libraryResult.error || "Failed to load user library.";
    console.error("Library Error:", libraryError);
    // If library fails, feed might still work, but isInLibrary will be false.
    // This is acceptable for v0.
  }

  const hasError = feedError || libraryError;

  return (
    <main className="">
      {/* Error Display */}
      {hasError && (
        <div className="mb-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Could not load all data:</p>
            {feedError && <p className="text-sm">- Feed: {feedError}</p>}
            {libraryError && (
              <p className="text-sm">- Library: {libraryError}</p>
            )}
          </div>
        </div>
      )}

      {/* Feed Content */}
      {!feedError && feedGames.length === 0 ? (
        <p className="text-muted-foreground">
          Your feed is empty. Add some games to your library to get
          recommendations, or try searching!
        </p>
      ) : !feedError ? (
        <div className="flex flex-col gap-4">
          {/* GameCard now needs to handle linking internally */}
          {feedGames.map((game) => (
            <GameCard
              key={game.id}
              game={game} // Pass the whole game object
              isInLibrary={libraryGameIds.has(game.id)}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
            />
          ))}
        </div>
      ) : // If feedError is present, don't show the empty message or the list
      // The error message above is sufficient.
      null}
    </main>
  );
}
