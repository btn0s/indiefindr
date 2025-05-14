import { NextRequest, NextResponse } from "next/server";
import type { SteamRawData } from "@/types/steam";
import { getGameRepository } from "@/lib/repositories";
import { logger } from "@/lib/logger";

// Consistent type from feed-display.tsx ApiGame
interface RecentApiGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
  foundByUsername?: string | null;
  foundByAvatarUrl?: string | null;
  createdAt?: string | Date | null;
}

interface RecentGamesResult {
  success: boolean;
  data?: RecentApiGame[];
  message?: string;
}

const DEFAULT_LIMIT = 4; // Default number of games per page

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(
    searchParams.get("limit") || String(DEFAULT_LIMIT),
    10
  );

  // Validate page and limit
  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, Math.min(50, limit)); // Add a max limit for safety
  const offset = (pageNum - 1) * limitNum;

  try {
    // Use the repository to get recent games
    const gameRepository = getGameRepository();
    const recentGames = await gameRepository.search({
      limit: limitNum,
      offset,
      orderBy: "newest"
    });

    // Transform the data to match the expected API response format
    const formattedGames: RecentApiGame[] = recentGames.map(game => ({
      id: game.id,
      title: game.title,
      shortDescription: game.descriptionShort,
      steamAppid: game.steamAppid,
      tags: game.tags,
      rawData: game.rawData as SteamRawData | null,
      // Note: We don't have the username and avatar directly from the repository
      // In a complete implementation, we would need to join with profiles or make a separate query
      createdAt: game.createdAt
    }));

    return NextResponse.json({ success: true, data: formattedGames });
  } catch (error) {
    logger.error("Error fetching recent games:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch recent games." },
      { status: 500 }
    );
  }
}
