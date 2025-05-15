import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import {
  cosineDistance,
  desc,
  eq,
  inArray,
  isNotNull,
  and,
  sql,
  or,
  notInArray,
} from "drizzle-orm";
// import type { SteamRawData } from "@/types/steam"; // GameService handles rawData transformation
import { DrizzleUserRepository } from "@/lib/repositories/user-repository";
import { DefaultGameService } from "@/services/game-service"; // Import GameService
import { GameCardViewModel } from "@/services/game-service"; // Import GameCardViewModel
import type { GameWithSubmitter } from "@/lib/repositories/game-repository"; // For type casting db result
import { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // <-- ADD THIS

const VECTOR_DIMENSIONS = 384;
const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 3;
const ITEMS_PER_PAGE = 4;

// Remove local FeedGame interface, we will use GameCardViewModel
// interface FeedGame { ... }

interface FeedResponse {
  games: GameCardViewModel[]; // Expect GameCardViewModel here
  nextPage: number | null;
  totalGames: number;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<FeedResponse | { message: string; error?: string }>> {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
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
  const userRepository = new DrizzleUserRepository();
  const gameService = new DefaultGameService(); // Instantiate GameService
  const gameRepository = new DrizzleGameRepository(); // <-- Instantiate GameRepository

  if (authenticatedUser && !authError) {
    try {
      const ids = await userRepository.getLibraryGameIds(authenticatedUser.id);
      userLibraryGameIdsSet = new Set(ids);
    } catch (libError) {
      console.error(
        "Feed API: Error fetching library game IDs for user:",
        authenticatedUser.id,
        libError
      );
    }
  }

  const offset = (page - 1) * limit;
  let gamesToProcess: GameWithSubmitter[] = [];

  try {
    let recommendationIds: number[] = [];
    const excludedFromFeed =
      userLibraryGameIdsSet.size > 0 ? Array.from(userLibraryGameIdsSet) : [-1];

    if (
      authenticatedUser &&
      userLibraryGameIdsSet.size >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING
    ) {
      const libraryEmbeddingsResult = await db
        .select({ embedding: schema.gamesTable.embedding })
        .from(schema.gamesTable)
        .where(
          and(
            inArray(schema.gamesTable.id, Array.from(userLibraryGameIdsSet)),
            isNotNull(schema.gamesTable.embedding)
          )
        );

      const validEmbeddings = libraryEmbeddingsResult
        .map((r) => r.embedding)
        .filter(
          (e) => e !== null && e.length === VECTOR_DIMENSIONS
        ) as number[][];

      if (validEmbeddings.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING) {
        const avgEmbedding = validEmbeddings
          .reduce(
            (acc, emb) => emb.map((val, i) => acc[i] + val),
            Array(VECTOR_DIMENSIONS).fill(0)
          )
          .map((val) => val / validEmbeddings.length);

        const similarGames = await db
          .select({ id: schema.gamesTable.id })
          .from(schema.gamesTable)
          .where(
            and(
              notInArray(schema.gamesTable.id, excludedFromFeed),
              isNotNull(schema.gamesTable.embedding)
            )
          )
          .orderBy(cosineDistance(schema.gamesTable.embedding, avgEmbedding))
          .limit(limit);

        recommendationIds = similarGames.map((g) => g.id);
      }
    }

    if (recommendationIds.length < limit) {
      const needed = limit - recommendationIds.length;
      const newestGames = await db
        .select({ id: schema.gamesTable.id })
        .from(schema.gamesTable)
        .where(
          notInArray(schema.gamesTable.id, [
            ...excludedFromFeed,
            ...recommendationIds,
          ])
        )
        .orderBy(desc(schema.gamesTable.createdAt))
        .limit(needed)
        .offset(recommendationIds.length > 0 ? 0 : offset);

      recommendationIds.push(...newestGames.map((g) => g.id));
    }

    recommendationIds = [...new Set(recommendationIds)].slice(0, limit);

    if (recommendationIds.length > 0) {
      // Fetch data using the modified GameRepository.getGamesByIds
      gamesToProcess = await gameRepository.getGamesByIds(recommendationIds);
      // The repository method now handles fetching GameWithSubmitter, re-ordering, and casting rawData.
    }

    // Transform to GameCardViewModel using GameService
    const finalGamesViewModels: GameCardViewModel[] =
      gameService.toGameCardViewModels(gamesToProcess);

    // Add isInLibrary property. GameService produces ViewModels, but isInLibrary is context-specific to the current user.
    const gamesWithLibraryStatus = finalGamesViewModels.map((game) => ({
      ...game,
      isInLibrary: userLibraryGameIdsSet.has(game.id),
    }));

    console.log(
      "responseGames (GameCardViewModel with isInLibrary)",
      gamesWithLibraryStatus
    );

    return NextResponse.json({
      games: gamesWithLibraryStatus,
      nextPage: gamesWithLibraryStatus.length === limit ? page + 1 : null,
      totalGames: gamesWithLibraryStatus.length,
    });
  } catch (error: any) {
    console.error("Error in GET /api/feed:", error);
    return NextResponse.json(
      { message: "Failed to fetch feed", error: error.message },
      { status: 500 }
    );
  }
}
