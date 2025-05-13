import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import { ilike, or, desc, count, sql, inArray } from "drizzle-orm";
import { GameCardMini } from "@/components/game-card-mini";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SteamRawData } from "@/types/steam";
import { getGameUrl } from "@/utils/game-url";

const Loading = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <Card key={i} className="h-full overflow-hidden">
            <Skeleton className="h-[215px] w-full" />
            <CardContent className="p-4">
              <Skeleton className="h-6 w-4/5 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-1" />
            </CardContent>
          </Card>
        ))}
    </div>
  );
};

interface SearchResultGame {
  id: number;
  title: string | null;
  externalId: string;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData?: SteamRawData | null;
}

interface SearchPageProps {
  searchParams?: {
    q?: string;
  };
}

async function performSearch(query: string): Promise<{
  results: SearchResultGame[];
  error: string | null;
}> {
  if (!query || query.trim() === "") {
    return {
      results: [],
      error: null,
    };
  }

  console.log(`[Server Search] Received search query: "${query}"`);

  try {
    const queryTerms = query.trim().split(/\s+/).filter(Boolean);

    let searchResultsDb = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        rawData: schema.externalSourceTable.rawData,
      })
      .from(schema.externalSourceTable)
      .where(
        or(
          ilike(schema.externalSourceTable.title, `%${query}%`),
          ilike(schema.externalSourceTable.descriptionShort, `%${query}%`)
        )
      )
      .limit(20)
      .execute();

    console.log(
      "[Server Search] DB results after initial query:",
      searchResultsDb
    );

    if (searchResultsDb.length === 0 && queryTerms.length > 1) {
      const conditions = queryTerms.map((term) =>
        or(
          ilike(schema.externalSourceTable.title, `%${term}%`),
          ilike(schema.externalSourceTable.descriptionShort, `%${term}%`)
        )
      );

      searchResultsDb = await db
        .select({
          id: schema.externalSourceTable.id,
          title: schema.externalSourceTable.title,
          externalId: schema.externalSourceTable.externalId,
          steamAppid: schema.externalSourceTable.steamAppid,
          descriptionShort: schema.externalSourceTable.descriptionShort,
          rawData: schema.externalSourceTable.rawData,
        })
        .from(schema.externalSourceTable)
        .where(or(...conditions))
        .limit(20)
        .execute();

      console.log(
        "[Server Search] DB results after fallback query:",
        searchResultsDb
      );
    }

    console.log(
      `[Server Search] Found ${searchResultsDb.length} results for query "${query}".`
    );

    const formattedResults: SearchResultGame[] = searchResultsDb.map(
      (game) => ({
        id: game.id,
        title: game.title,
        externalId: game.externalId,
        steamAppid: game.steamAppid,
        descriptionShort: game.descriptionShort,
        rawData: game.rawData as SteamRawData | null,
      })
    );

    return { results: formattedResults, error: null };
  } catch (error: any) {
    console.error(
      `[Server Search] Error during search for query "${query}":`,
      error
    );
    return {
      results: [],
      error: "Internal server error during search. Please try again.",
    };
  }
}

// Function to fetch and aggregate popular categories/tags
async function getPopularCategories(limit: number = 50): Promise<string[]> {
  try {
    const recentGamesWithCategories = await db
      .select({
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
      })
      .from(schema.externalSourceTable)
      .orderBy(desc(schema.externalSourceTable.createdAt)) // Get categories from recent additions
      .limit(limit);

    const categoryCounts: { [key: string]: number } = {};

    recentGamesWithCategories.forEach((game) => {
      const categories = [...(game.genres || []), ...(game.tags || [])];
      categories.forEach((category) => {
        if (category && category.trim() !== "") {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      });
    });

    // Sort categories by frequency and return the top ones
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([category]) => category);

    return sortedCategories.slice(0, 12); // Return top 12
  } catch (error) {
    console.error("[Server Search] Error fetching popular categories:", error);
    return []; // Return empty array on error
  }
}

const getSteamImageUrl = (steamAppid: string | null) => {
  return steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppid}/header.jpg`
    : "/placeholder-game.jpg"; // Fallback image
};

// Define a consistent type for games displayed in sections
interface DisplayGame {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData?: SteamRawData | null;
}

async function getRecentlyAddedGames(
  limit: number = 6
): Promise<DisplayGame[]> {
  try {
    const recentGames = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        rawData: schema.externalSourceTable.rawData,
      })
      .from(schema.externalSourceTable)
      .orderBy(desc(schema.externalSourceTable.createdAt))
      .limit(limit);
    return recentGames.map((game) => ({
      ...game,
      rawData: game.rawData as SteamRawData | null,
    }));
  } catch (error) {
    console.error("[Server Search] Error fetching recent games:", error);
    return [];
  }
}

async function getPopularGames(limit: number = 6): Promise<DisplayGame[]> {
  try {
    // Step 1: Find the most frequent gameRefId in the library table
    const popularGameIdsResult = await db
      .select({
        gameId: schema.libraryTable.gameRefId,
        saveCount: count(schema.libraryTable.userId).as("save_count"),
      })
      .from(schema.libraryTable)
      .groupBy(schema.libraryTable.gameRefId)
      .orderBy(sql`save_count DESC`)
      .limit(limit);

    const popularGameIds = popularGameIdsResult.map((item) => item.gameId);

    if (popularGameIds.length === 0) {
      return [];
    }

    // Step 2: Fetch details for these popular games
    const popularGamesDetails = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        rawData: schema.externalSourceTable.rawData,
      })
      .from(schema.externalSourceTable)
      .where(inArray(schema.externalSourceTable.id, popularGameIds));

    // Step 3: Map to DisplayGame and preserve order (optional but good practice)
    const gamesMap = new Map<number, DisplayGame>(
      popularGamesDetails.map((game) => [
        game.id,
        { ...game, rawData: game.rawData as SteamRawData | null },
      ])
    );

    return popularGameIds
      .map((id) => gamesMap.get(id))
      .filter((game): game is DisplayGame => game !== undefined);
  } catch (error) {
    console.error("[Server Search] Error fetching popular games:", error);
    return [];
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q || "";

  // Fetch search results OR initial page data based on query presence
  let searchResults: SearchResultGame[] = [];
  let searchError: string | null = null;
  let popularCategories: string[] = [];
  let recentGames: DisplayGame[] = [];
  let popularGames: DisplayGame[] = [];

  if (query) {
    const searchData = await performSearch(query);
    searchResults = searchData.results;
    searchError = searchData.error;
  } else {
    // Fetch data for the initial page state concurrently
    [popularCategories, recentGames, popularGames] = await Promise.all([
      getPopularCategories(),
      getRecentlyAddedGames(),
      getPopularGames(),
    ]);
  }

  console.log("searchResults being passed to page component:", searchResults);
  console.log("popular categories being passed:", popularCategories);
  console.log("recent games being passed:", recentGames);
  console.log("popular games being passed:", popularGames);

  return (
    <div className="container max-w-5xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Search Games</h1>

        <form method="GET" action="/search" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search games by title..."
            className="flex-1"
            aria-label="Search games by title"
            autoFocus
          />
          <Button type="submit">
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>

        {/* Popular Categories - Show only when no query */}
        {!query && popularCategories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm font-medium mr-2 self-center">
              Popular Categories:
            </span>
            {popularCategories.map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                className="h-7"
                asChild
              >
                <Link href={`/search?q=${encodeURIComponent(category)}`}>
                  {category}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>

      <Suspense fallback={<Loading />}>
        {query ? (
          <>
            {searchError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-4 mb-6">
                {searchError}
              </div>
            )}

            {searchResults.length === 0 && !searchError && (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No games found matching "{query}"
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((game) => (
                <GameCardMini
                  key={game.id}
                  game={{
                    id: game.id,
                    title: game.title,
                    steamAppid: game.steamAppid,
                    descriptionShort: game.descriptionShort,
                    rawData: game.rawData,
                  }}
                  detailsLinkHref={getGameUrl(game.id, game.title)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-8">
            {/* Recently Added Games */}
            <Card>
              <CardHeader>
                <CardTitle>Recently Added</CardTitle>
              </CardHeader>
              <CardContent>
                {recentGames.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentGames.map((game) => (
                      <GameCardMini
                        key={game.id}
                        game={game}
                        detailsLinkHref={getGameUrl(game.id, game.title)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No recently added games found.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Popular Games (Most Saved) */}
            <Card>
              <CardHeader>
                <CardTitle>Popular Games</CardTitle>
              </CardHeader>
              <CardContent>
                {popularGames.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {popularGames.map((game) => (
                      <GameCardMini
                        key={game.id}
                        game={game}
                        detailsLinkHref={getGameUrl(game.id, game.title)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No popular games found (based on saves).
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Suspense>
    </div>
  );
}
