import React from "react";
import { GameCard } from "@/components/game-card";
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
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // TODO: Improve this - maybe redirect to sign-in or show public content
    return <p>Please sign in to see your personalized feed.</p>;
  }

  // Fetch feed and library data
  const feedResultPromise = getPersonalizedFeed(); // Call the server action
  const libraryResultPromise = getLibraryGameIds();

  const [feedResult, libraryResult] = await Promise.all([
    feedResultPromise,
    libraryResultPromise,
  ]);

  let feedGames: FeedGame[] = [];
  if (feedResult.success && feedResult.data) {
    feedGames = feedResult.data;
  } else if (!feedResult.success) {
    console.error("Failed to fetch personalized feed:", feedResult.message);
    // TODO: Show error state in UI?
  }

  let libraryGameIds = new Set<number>();
  if (libraryResult.success && libraryResult.data) {
    libraryGameIds = new Set(libraryResult.data);
  } else if (!libraryResult.success) {
    console.error("Failed to fetch library game IDs:", libraryResult.error);
    // Optionally, show an error to the user or handle gracefully
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your Personalized Feed</h1>

      {feedGames.length === 0 ? (
        <p>
          Your feed is empty. Add some games to your library to get
          recommendations!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {feedGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isInLibrary={libraryGameIds.has(game.id)}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
            />
          ))}
        </div>
      )}
    </main>
  );
}
