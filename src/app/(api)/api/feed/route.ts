import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { DefaultGameService, GameCardViewModel } from "@/services/game-service";
import { DrizzleUserRepository } from "@/lib/repositories/user-repository";
import { FeedType } from "@/hooks/useFeed";

const ITEMS_PER_PAGE = 12; // Default limit, service might have its own internal default too

interface FeedResponse {
  items: (GameCardViewModel & { isInLibrary: boolean })[];
  nextPage: number | null;
  page: number;
  pageSize: number;
  feedType: FeedType;
  hasMore: boolean;
  // totalItems: number; // Total available games for the query is harder to get with current service methods
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<FeedResponse | { message: string; error?: string }>> {
  // Instantiate services per request
  const gameService = new DefaultGameService();
  const userRepository = new DrizzleUserRepository();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  // The `limit` will be passed to the service, which uses FEED_SIZE (12) as its internal default if not specified.
  const limit = parseInt(
    searchParams.get("limit") || ITEMS_PER_PAGE.toString(),
    10
  );

  const supabase = await createClient();
  const {
    data: { user: authenticatedUser },
    error: authError,
  } = await supabase.auth.getUser();

  let userLibraryGameIdsSet = new Set<number>();
  if (authenticatedUser && !authError) {
    try {
      const ids = await userRepository.getLibraryGameIds(authenticatedUser.id);
      userLibraryGameIdsSet = new Set(ids);
    } catch (libError) {
      console.error(
        "Feed API: Error fetching library game IDs for user:",
        authenticatedUser?.id,
        libError
      );
    }
  }

  try {
    let feedGamesData: GameCardViewModel[];

    if (authenticatedUser) {
      console.log(
        `Feed API: Fetching personalized feed for user ${authenticatedUser.id}, page ${page}, limit ${limit}`
      );
      // GameService.getPersonalizedFeedForUser handles its own limit (defaults to FEED_SIZE which is 12)
      // and excludes library games internally.
      feedGamesData = await gameService.getPersonalizedFeedForUser(
        authenticatedUser.id,
        limit,
        page
      );
    } else {
      console.log(
        `Feed API: Fetching generic recent games feed, page ${page}, limit ${limit}`
      );
      // GameService.getRecentGamesForFeed also has its own default limit (20 currently)
      feedGamesData = await gameService.getRecentGamesForFeed(limit, page);
    }

    const gamesWithLibraryStatus = feedGamesData.map((game) => ({
      ...game,
      isInLibrary: userLibraryGameIdsSet.has(game.id),
    }));

    // Pagination: nextPage can be determined if the number of items returned is equal to the limit requested.
    // This isn't a perfect indicator of more data unless the service guarantees to return `limit` items if more exist.
    const hasMore = gamesWithLibraryStatus.length === limit;
    const currentFeedType =
      (searchParams.get("type") as FeedType) ||
      (authenticatedUser ? "personalized" : "all");

    return NextResponse.json({
      items: gamesWithLibraryStatus,
      page: page,
      pageSize: limit,
      feedType: currentFeedType,
      hasMore: hasMore,
      nextPage: hasMore ? page + 1 : null,
      // totalItems: gamesWithLibraryStatus.length, // Optional, can be added if needed
    });
  } catch (error: any) {
    console.error("Error in GET /api/feed:", error);
    return NextResponse.json(
      { message: "Failed to fetch feed", error: error.message },
      { status: 500 }
    );
  }
}
