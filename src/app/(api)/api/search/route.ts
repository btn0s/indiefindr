import { NextResponse } from "next/server";
// import { db, schema } from "@/db"; // No longer directly needed
// import { sql, ilike, or } from "drizzle-orm"; // No longer directly needed
import {
  DrizzleGameRepository,
  Game,
  GameSearchParams,
} from "@/lib/repositories/game-repository";
// import type { SteamRawData } from "@/types/steam"; // Potentially for casting rawData, keep if SearchResultGame needs specific rawData type

// Define the structure of the game data to return for search results
// This type is already a Pick from Game, which is what gameRepository.search returns.
// So, the mapping below will mostly be for type safety or if specific transformations were needed.
type SearchResultGame = Pick<
  Game,
  | "id"
  | "title"
  | "externalId"
  | "steamAppid"
  | "descriptionShort"
  | "developer"
  | "genres"
  | "tags"
  | "rawData"
>;

const gameRepository = new DrizzleGameRepository();

export async function GET(request: Request) {
  const urlSearchParams = new URL(request.url).searchParams;

  const query = urlSearchParams.get("q") || undefined;
  const tagsParam = urlSearchParams.get("tags");
  const genresParam = urlSearchParams.get("genres");
  const limitParam = urlSearchParams.get("limit");
  const offsetParam = urlSearchParams.get("offset");
  const orderByParam = urlSearchParams.get("orderBy");
  const excludeIdsParam = urlSearchParams.get("excludeIds");
  const isFeaturedParam = urlSearchParams.get("isFeatured");

  if (!query && !tagsParam && !genresParam && !isFeaturedParam) {
    // Require at least one substantive search filter if not a generic browse
    return NextResponse.json(
      { error: "Search query, tags, genres, or featured flag is required" },
      { status: 400 }
    );
  }

  const searchParams: GameSearchParams = {
    query: query,
    tags: tagsParam
      ? tagsParam
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined,
    genres: genresParam
      ? genresParam
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean)
      : undefined,
    limit: limitParam ? parseInt(limitParam, 10) : 20,
    offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    orderBy: orderByParam as GameSearchParams["orderBy"], // Basic cast, validate if necessary
    excludeIds: excludeIdsParam
      ? excludeIdsParam
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id))
      : undefined,
    isFeatured: isFeaturedParam
      ? isFeaturedParam.toLowerCase() === "true"
      : undefined,
  };

  console.log(`[API /search] Received search with params:`, searchParams);

  try {
    const searchResults: Game[] = await gameRepository.search(searchParams);

    console.log(`[API /search] Found ${searchResults.length} results.`);

    // The SearchResultGame is a Pick from Game, so direct spread should be fine.
    // This mapping step is more for explicit type conformance or if transformations were needed.
    const formattedResults: SearchResultGame[] = searchResults.map((game) => ({
      ...game,
    }));

    return NextResponse.json(formattedResults);
  } catch (error: any) {
    console.error(
      `[API /search] Error during search with params: ${JSON.stringify(searchParams)}`,
      error
    );
    return NextResponse.json(
      { error: "Internal server error during search.", details: error.message },
      { status: 500 }
    );
  }
}
