"use client";

import React from "react";
import { GameCardMini } from "./game-card-mini";
import { getGameUrl } from "@/lib/utils"; // Import utility for generating game URLs
import { GameCardViewModel } from "@/services/game-service";

interface GameGridProps {
  games: GameCardViewModel[]; // Use the more comprehensive type
  loggedInUserLibraryIds: Set<number>;
  onAddToLibrary?: (gameId: number) => Promise<any>;
  onRemoveFromLibrary?: (gameId: number) => Promise<any>;
  gridClassName?: string;
}

export function GameGrid({
  games,
  loggedInUserLibraryIds,
  onAddToLibrary,
  onRemoveFromLibrary,
  gridClassName = "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4", // Adjusted grid cols
}: GameGridProps) {
  if (!games || games.length === 0) {
    return <p className="text-muted-foreground">No games to display.</p>;
  }

  return (
    <div className={gridClassName}>
      {games.map((game) => (
        <GameCardMini
          key={game.id}
          game={game}
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
