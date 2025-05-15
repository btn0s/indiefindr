"use server";

import { DefaultGameService, GameCardViewModel } from "@/services/game-service";
// No longer need direct db access or schema here
// import { db } from "@/db";
// import { gamesTable } from "@/db/schema";
// import { desc } from "drizzle-orm";
// import type { SteamRawData } from "@/types/steam";

// The GameCardViewModel from game-service is more comprehensive and standardized
// than the local RecentGame interface, so we can rely on that.
// interface RecentGame { ... } // This can be removed

const gameService = new DefaultGameService(); // Instantiate the service

export async function getRecentGames(limit: number = 20): Promise<{
  success: boolean;
  data?: GameCardViewModel[]; // Use GameCardViewModel as the return type for data
  message?: string;
}> {
  try {
    // Call the service layer method
    const recentGamesData = await gameService.getRecentGamesForFeed(limit);

    return {
      success: true,
      data: recentGamesData,
    };
  } catch (error) {
    console.error(
      "Error in getRecentGames action while calling gameService:",
      error
    );
    // It's good practice for the service layer to handle its own errors and log them.
    // The action can then decide how to present that error to the caller/client.
    // If gameService.getRecentGamesForFeed already returns [] on error or throws a specific type of error,
    // this catch block can be adjusted.
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch recent games via service.",
    };
  }
}
