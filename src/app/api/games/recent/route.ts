import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import type { SteamRawData } from "@/types/steam";

// Consistent type from feed-display.tsx ApiGame
interface RecentApiGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

interface RecentGamesResult {
  success: boolean;
  data?: RecentApiGame[];
  message?: string;
}

const RECENT_GAMES_LIMIT = 20; // Consistent with original action

export async function GET(): Promise<NextResponse<RecentGamesResult>> {
  try {
    const recentGamesData = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        shortDescription: schema.externalSourceTable.descriptionShort,
        steamAppid: schema.externalSourceTable.steamAppid,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
      })
      .from(schema.externalSourceTable)
      .orderBy(desc(schema.externalSourceTable.createdAt)) // Prefer createdAt for recency
      .limit(RECENT_GAMES_LIMIT);

    return NextResponse.json({
      success: true,
      // Cast rawData for each game to satisfy the ApiGame interface if necessary
      data: recentGamesData.map((game) => ({
        ...game,
        rawData: game.rawData as SteamRawData | null,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching recent games in /api/games/recent:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch recent games: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
