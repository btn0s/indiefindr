import { NextRequest, NextResponse } from "next/server";
import {
  DrizzleGameRepository,
  GameWithSubmitter,
  GameSearchParams,
} from "@/lib/repositories/game-repository";
import { DefaultGameService } from "@/lib/services/game-service";
import type { GameCardViewModel } from "@/lib/services/game-service";

interface RecentGamesResult {
  success: boolean;
  data?: GameCardViewModel[];
  message?: string;
}

const DEFAULT_LIMIT = 10; // Default number of games for this route
const gameRepository = new DrizzleGameRepository();
const gameService = new DefaultGameService();

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
    const recentGamesFromRepo: GameWithSubmitter[] =
      await gameRepository.search(searchParams);

    // Transform data using GameService
    const transformedGames: GameCardViewModel[] =
      gameService.toGameCardViewModels(recentGamesFromRepo);

    return NextResponse.json({ success: true, data: transformedGames });
  } catch (error) {
    console.error("Error fetching recent games:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch recent games." },
      { status: 500 }
    );
  }
}
