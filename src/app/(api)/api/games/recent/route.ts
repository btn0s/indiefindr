import { NextRequest, NextResponse } from "next/server";
import {
  DrizzleGameRepository,
  GameWithSubmitter,
  GameSearchParams,
} from "@/lib/repositories/game-repository";

interface RecentGamesResult {
  success: boolean;
  data?: GameWithSubmitter[]; // Directly use GameWithSubmitter
  message?: string;
}

const DEFAULT_LIMIT = 10; // Default number of games for this route
const gameRepository = new DrizzleGameRepository();

export async function GET(
  request: NextRequest
): Promise<NextResponse<RecentGamesResult>> {
  const urlSearchParams = new URL(request.url).searchParams;
  const page = parseInt(urlSearchParams.get("page") || "1", 10);
  const limit = parseInt(
    urlSearchParams.get("limit") || String(DEFAULT_LIMIT),
    10
  );

  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, Math.min(50, limit)); // Max limit for safety
  const offset = (pageNum - 1) * limitNum;

  const searchParams: GameSearchParams = {
    orderBy: "newest",
    limit: limitNum,
    offset: offset,
    includeSubmitter: true, // This route specifically needs submitter info
  };

  try {
    const recentGames: GameWithSubmitter[] =
      await gameRepository.search(searchParams);

    // The old RecentApiGame had a shortDescription field. GameWithSubmitter has descriptionShort.
    // Let's ensure the API response is consistent or update frontend if it now expects descriptionShort.
    // For now, I'll map to ensure shortDescription exists if the frontend still relies on it.
    const apiResponseData = recentGames.map((game) => ({
      ...game,
      shortDescription: game.descriptionShort, // Explicitly map for compatibility
    }));

    return NextResponse.json({ success: true, data: apiResponseData });
  } catch (error) {
    console.error("Error fetching recent games:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch recent games." },
      { status: 500 }
    );
  }
}
