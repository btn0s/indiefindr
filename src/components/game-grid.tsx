"use client";

import React from "react";
import { GameCardMini } from "./game-card-mini";
import type { SteamRawData } from "@/types/steam"; // Keep for backward compatibility
import type { GameListItemViewModel } from "@/types/game-models"; // Import the new view model type
import { getGameUrl } from "@/lib/utils"; // Import utility for generating game URLs

// For backward compatibility with existing code
interface GridGame {
  id: number;
  title: string | null;
  steamAppid?: string | null;
  steamAppId?: string | null; // New format uses steamAppId
  descriptionShort?: string | null;
  description?: string | null; // New format uses description
  rawData?: SteamRawData | null;
  foundByUsername?: string | null;
  foundByAvatarUrl?: string | null;
}

interface GameGridProps {
  games: Array<GridGame | GameListItemViewModel>;
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
          // Pass the entire game object down.
          // GameCardMini will handle both old and new formats
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
