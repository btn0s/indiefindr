"use client";

import React from "react";
import { GameCardMini } from "./game-card-mini";
import { getGameUrl } from "@/utils/game-url"; // Assuming you have or will create this utility

// Define the shape of game data expected by this grid component
// Needs fields required by GameCardMini and getGameUrl
type GameForGrid = {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort?: string | null;
  // Add any other fields GameCardMini might eventually need (e.g., tags)
};

interface GameGridProps {
  games: GameForGrid[];
  loggedInUserLibraryIds: Set<number>; // IDs of games in the logged-in user's library
  // Pass server actions as props from the Server Component parent
  onAddToLibrary: (gameId: number) => Promise<any>;
  onRemoveFromLibrary: (gameId: number) => Promise<any>;
  gridClassName?: string; // Optional class for customizing the grid layout
}

export function GameGrid({
  games,
  loggedInUserLibraryIds,
  onAddToLibrary,
  onRemoveFromLibrary,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
}: GameGridProps) {
  if (!games || games.length === 0) {
    return <p className="text-muted-foreground">No games to display.</p>;
  }

  return (
    <div className={gridClassName}>
      {games.map((game) => (
        <GameCardMini
          key={game.id}
          game={{
            id: game.id,
            title: game.title,
            steamAppid: game.steamAppid,
            descriptionShort: game.descriptionShort,
          }}
          detailsLinkHref={getGameUrl(game.id, game.title)}
          isInLibrary={loggedInUserLibraryIds.has(game.id)}
          onAddToLibrary={onAddToLibrary}
          onRemoveFromLibrary={onRemoveFromLibrary}
        />
      ))}
    </div>
  );
}

// Potential utility function (move to src/utils/game-url.ts or similar)
// Make sure this matches the logic used in search/page.tsx if needed elsewhere
// export const getGameUrl = (id: number, title: string | null): string => {
//   const slug = title
//     ? title
//         .toLowerCase()
//         .replace(/[^a-z0-9\s-]/g, "") // Escaped regex character
//         .replace(/\s+/g, "-")       // Escaped regex character
//     : "unknown";
//   return `/games/${id}/${slug}`;
// };
