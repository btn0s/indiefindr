import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, X } from "lucide-react";
import { db, schema } from "@/db";
import { desc, count, sql, inArray } from "drizzle-orm";
import { GameCardMini } from "@/components/game-card-mini";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SteamRawData } from "@/types/steam";
import { getGameUrl } from "@/utils/game-url";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { searchSteam, type SteamSearchResult } from "@/lib/steam-search";
import { DrizzleGameRepository } from "@/lib/repositories/game-repository";
import type { GameWithSubmitter } from "@/lib/repositories/game-repository";

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
  title: string;
  externalId: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData: SteamRawData | null;
}

interface SearchPageProps {
  searchParams?: Promise<{
    q?: string;
    tags?: string;
  }>;
}

// Instantiate the repository
const gameRepository = new DrizzleGameRepository();

async function performSearch(
  query?: string,
  tagsQuery?: string
): Promise<{
  results: SearchResultGame[];
  error: string | null;
}> {
  const queryTrimmed = query?.trim();
  const tagsArray = tagsQuery
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!queryTrimmed && (!tagsArray || tagsArray.length === 0)) {
    return { results: [], error: null };
  }

  console.log(
    `[Server Search] Received query: "${queryTrimmed}", tags: "${tagsQuery}"`
  );

  try {
    // Use the repository's search method
    const searchParams = {
      query: queryTrimmed,
      tags: tagsArray,
      limit: 20, // Default limit, adjust as needed
      includeSubmitter: false, // Not needed for search results page
    };

    const searchResultsDb: GameWithSubmitter[] =
      await gameRepository.search(searchParams);

    console.log("[Server Search] DB results from repository:", searchResultsDb);

    console.log(
      `[Server Search] Found ${searchResultsDb.length} results for query: "${queryTrimmed}", tags: "${tagsQuery}".`
    );

    const formattedResults: SearchResultGame[] = searchResultsDb.map(
      (game) => ({
        id: game.id,
        title: game.title ?? "",
        externalId: game.externalId,
        steamAppid: game.steamAppid,
        descriptionShort: game.descriptionShort,
        // Ensure rawData is cast correctly; GameWithSubmitter includes the full Game type
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

/**
 * Performs a search against the Steam API
 *
 * TODO: Future improvements:
 * - Add loading state indicator during Steam search
 * - Implement pagination for large result sets
 * - Add error handling with retry logic
 */
async function performSteamSearch(query: string): Promise<{
  results: SteamSearchResult[];
  error: string | null;
}> {
  if (!query.trim()) {
    return { results: [], error: null };
  }

  // Call the library function directly
  const steamSearchResult = await searchSteam(query);

  if (steamSearchResult.error) {
    console.error(
      `[SearchPage] Error from searchSteam for query "${query}": ${steamSearchResult.error}`,
      steamSearchResult.details || ""
    );
    // Decide how to handle errors for the UI.
    // For now, returning a generic error or null to keep previous behavior.
    return { results: [], error: "Failed to fetch results from Steam." };
  }

  return { results: steamSearchResult.results, error: null };
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const query = (await searchParams)?.q;
  const tags = (await searchParams)?.tags;

  if (tags) {
    const capitalizedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
      .join(", "); // Capitalize for title
    return {
      title: `${capitalizedTags} Games | IndieFindr`,
      description: `Find and discover ${capitalizedTags} games, and more indie titles on IndieFindr.`,
    };
  } else if (query) {
    return {
      title: `Search results for "${query}" | IndieFindr`,
      description: `Discover games matching "${query}" on IndieFindr.`,
    };
  }

  return {
    title: "Search Indie Games | IndieFindr",
    description:
      "Search, filter, and discover your next favorite indie game on IndieFindr.",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Get the current user for attribution
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  let searchResults: SearchResultGame[] = [];
  let searchError: string | null = null;
  let popularCategories: string[] = [];
  let recentGames: DisplayGame[] = [];
  let popularGames: DisplayGame[] = [];
  let steamSearchResults: SteamSearchResult[] = [];
  let steamSearchError: string | null = null;

  const currentSearchParams = await searchParams;
  const searchQuery = currentSearchParams?.q || "";
  const tagsSearch = currentSearchParams?.tags;

  if (searchQuery || tagsSearch) {
    const localSearchPromise = performSearch(searchQuery, tagsSearch);
    let steamSearchPromise: Promise<{
      results: SteamSearchResult[];
      error: string | null;
    } | null> = Promise.resolve(null);

    if (searchQuery) {
      steamSearchPromise = performSteamSearch(searchQuery);
    }

    const [localData, steamData] = await Promise.all([
      localSearchPromise,
      steamSearchPromise,
    ]);

    if (localData) {
      searchResults = localData.results;
      searchError = localData.error;
    }

    // steamData can be null if searchQuery was empty, or the result of performSteamSearch
    if (steamData && steamData.results) {
      steamSearchResults = steamData.results;
      steamSearchError = steamData.error;
    }

    // Filter Steam results to exclude any games already present in local results
    if (searchResults.length > 0 && steamSearchResults.length > 0) {
      const localSteamAppids = new Set(
        searchResults.map((game) => game.steamAppid).filter(Boolean)
      ); // Filter out null/undefined appids
      steamSearchResults = steamSearchResults.filter(
        (steamGame) => !localSteamAppids.has(steamGame.appid.toString())
      );
    }
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

  const currentSearchTags = (await searchParams)?.tags || "";

  // Determine dynamic H1 title
  let pageTitle = "Search Games";
  if (tagsSearch && !searchQuery) {
    const capitalizedTagsHeader = tagsSearch
      .split(",")
      .map((tag) => tag.trim())
      .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
      .join(", ");
    pageTitle = `Explore ${capitalizedTagsHeader} Games`;
  } else if (searchQuery || tagsSearch) {
    // If any search is active
    pageTitle = "Search Results";
  }

  return (
    <div className="container max-w-5xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">{pageTitle}</h1>

        <form method="GET" action="/search" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search games by title..."
            className="flex-1"
            aria-label="Search games by title"
            autoFocus
          />
          {currentSearchTags && (
            <input type="hidden" name="tags" value={currentSearchTags} />
          )}
          <Button type="submit">
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>

        {/* Active Filter Display & Clear Button */}
        {tagsSearch && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span>Filtering by Tag:</span>
            <Badge variant="secondary" className="text-sm">
              {tagsSearch}
            </Badge>
            <Link
              href={
                searchQuery
                  ? `/search?q=${encodeURIComponent(searchQuery)}`
                  : "/search"
              }
              passHref
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Clear tag filter"
              >
                <X className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* Popular Categories - Show only when no query */}
        {!searchQuery && popularCategories.length > 0 && (
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
                <Link href={`/search?tags=${encodeURIComponent(category)}`}>
                  {category}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>

      <Suspense fallback={<Loading />}>
        {searchQuery || tagsSearch ? (
          <>
            {searchError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-4 mb-6">
                {searchError}
              </div>
            )}

            {searchResults.length === 0 &&
              !searchError &&
              steamSearchResults.length === 0 &&
              !steamSearchError && (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    No games found matching "{searchQuery}"
                    {tagsSearch && ` with tags "${tagsSearch}"`}
                  </p>
                </div>
              )}

            {/* Display local database results */}
            {searchResults.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  Results from IndieFindr
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {searchResults.map((game) => (
                    <GameCardMini
                      key={`local-${game.id}`}
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
            )}

            {/* Display Steam search results using GameCardMini */}
            {steamSearchResults.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mt-8">
                  More to Explore on Steam
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Be the first to add these to IndieFindr!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {steamSearchResults.map((steamGame) => (
                    <GameCardMini
                      key={`steam-${steamGame.appid}`}
                      game={{
                        id: steamGame.appid, // Use appid as id for GameCardMini
                        title: steamGame.name,
                        steamAppid: steamGame.appid.toString(),
                        descriptionShort:
                          "Results from Steam. Not yet in IndieFindr.", // Placeholder description
                        rawData: {
                          // Construct minimal rawData
                          // Attempt to use the standard header image URL structure
                          header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appid}/header.jpg`,
                          // Use steamGame.icon (which is tiny_image from API) as a fallback screenshot
                          screenshots: steamGame.icon
                            ? [
                                {
                                  id: 0,
                                  path_thumbnail: steamGame.icon,
                                  path_full: steamGame.icon,
                                },
                              ]
                            : [],
                        },
                      }}
                      detailsLinkHref={`https://store.steampowered.com/app/${steamGame.appid}`}
                      isSteamOnlyResult={true}
                      currentUserId={userId}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Fallback for no results at all */}
            {searchResults.length === 0 &&
              steamSearchResults.length === 0 &&
              !searchError &&
              !steamSearchError &&
              (searchQuery || tagsSearch) && (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    No games found matching "{searchQuery}"
                    {tagsSearch && ` with tags "${tagsSearch}"`}
                  </p>
                </div>
              )}

            {steamSearchError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-4 mt-6">
                {steamSearchError}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-8">
            <div className="space-y-4">
              {/* Popular Games (Most Saved) */}
              <h2 className="text-2xl font-semibold">Popular Games</h2>
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

              {/* Recently Added Games */}
              <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Recently Added</h2>
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
              </div>
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
}
