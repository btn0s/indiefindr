import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { FeedType } from "@/hooks/useFeed";
import { DefaultFeedService, type FeedItem } from "@/services/feed-service";
import { DefaultGameService } from "@/services/game-service";
import { DefaultLibraryService } from "@/services/library-service";
import { DrizzleGameRepository } from "@/lib/repositories/game-repository";
import { DrizzleEnrichmentRepository } from "@/lib/repositories/enrichment-repository";

interface FeedResponse {
  items: FeedItem[];
  nextPage: number | null;
  page: number;
  pageSize: number;
  feedType: FeedType;
  hasMore: boolean;
  totalItems?: number;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<FeedResponse | { message: string; error?: string }>> {
  // Use existing Supabase client and auth pattern
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    // Log error but proceed as anonymous user for feed, or handle as critical error if auth is mandatory
    console.warn(
      "API /api/feed: Error fetching Supabase user:",
      authError.message
    );
  }
  const userId = user?.id;

  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") || "personalized";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "12", 10);

  if (isNaN(page) || page < 1) {
    return NextResponse.json(
      { message: "Invalid page number" },
      { status: 400 }
    );
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 50) {
    return NextResponse.json(
      { message: "Invalid pageSize (must be between 1 and 50)" },
      { status: 400 }
    );
  }

  try {
    const gameRepository = new DrizzleGameRepository();
    const enrichmentRepository = new DrizzleEnrichmentRepository();
    const libraryService = new DefaultLibraryService();
    const gameService = new DefaultGameService();

    const feedService = new DefaultFeedService(
      gameService,
      libraryService,
      gameRepository,
      enrichmentRepository
    );

    console.log(
      `API /api/feed: type=${type}, userId=${userId || "anonymous"}, page=${page}, pageSize=${pageSize}`
    );

    const feedItems: FeedItem[] = await feedService.getFeed({
      userId: userId || undefined,
      limit: pageSize,
      page,
    });

    const hasMore = feedItems.length === pageSize;

    const responsePayload: FeedResponse = {
      items: feedItems,
      page,
      pageSize,
      feedType: type as FeedType,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
      totalItems: feedItems.length,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("API /api/feed Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { message: `Failed to fetch feed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
