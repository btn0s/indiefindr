"use server";

import { db } from "@/db";
import { externalSourceTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import type { SteamRawData } from "@/types/steam";

// Define the expected shape of game data, similar to FeedGame in page.tsx
// and GameCardProps.game in game-card.tsx
interface RecentGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

export async function getRecentGames(): Promise<{
  success: boolean;
  data?: RecentGame[];
  message?: string;
}> {
  try {
    const recentGamesData = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        shortDescription: externalSourceTable.descriptionShort,
        steamAppid: externalSourceTable.steamAppid,
        tags: externalSourceTable.tags, // Assuming tags is stored as string[] or similar
        rawData: externalSourceTable.rawData, // Assuming rawData is stored appropriately
      })
      .from(externalSourceTable)
      .orderBy(desc(externalSourceTable.id)) // Order by ID descending to get recent ones
      .limit(20); // Limit to 20 games

    // Ensure the fetched data matches the RecentGame interface structure.
    // Drizzle should handle the type mapping based on schema and select, but explicit casting/mapping might be needed
    // if column names differ significantly or complex transformations are required.
    // For now, we assume direct mapping for selected fields.

    return {
      success: true,
      data: recentGamesData as RecentGame[], // Cast if confident in structure, otherwise map
    };
  } catch (error) {
    console.error("Error fetching recent games:", error);
    return {
      success: false,
      message: "Failed to fetch recent games.",
    };
  }
}
