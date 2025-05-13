import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, ArrowLeft, X } from "lucide-react";
import { db, schema } from "@/db";
import {
  ilike,
  or,
  desc,
  count,
  sql,
  inArray,
  and,
  arrayOverlaps,
} from "drizzle-orm";
import { GameCardMini } from "@/components/game-card-mini";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SteamRawData } from "@/types/steam";
import { getGameUrl } from "@/utils/game-url";
import type { Metadata } from "next";

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
    tags?: string;
  };
}

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
    const conditions = [];

    if (queryTrimmed) {
      const queryTerms = queryTrimmed.split(/\s+/).filter(Boolean);
      if (queryTerms.length === 1) {
        conditions.push(
          or(
            ilike(schema.externalSourceTable.title, `%${queryTrimmed}%`),
            ilike(
              schema.externalSourceTable.descriptionShort,
              `%${queryTrimmed}%`
            )
          )
        );
      } else if (queryTerms.length > 1) {
        const termConditions = queryTerms.map((term) =>
          or(
            ilike(schema.externalSourceTable.title, `%${term}%`),
            ilike(schema.externalSourceTable.descriptionShort, `%${term}%`)
          )
        );
        conditions.push(or(...termConditions));
      }
    }

    if (tagsArray && tagsArray.length > 0) {
      conditions.push(
        arrayOverlaps(schema.externalSourceTable.tags, tagsArray)
      );
    }

    if (conditions.length === 0) {
      return { results: [], error: "No search criteria provided." };
    }

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
      .where(and(...conditions))
      .limit(20)
      .execute();

    console.log(
      "[Server Search] DB results after initial query:",
      searchResultsDb
    );

    console.log(
      `[Server Search] Found ${searchResultsDb.length} results for query: "${queryTrimmed}", tags: "${tagsQuery}".`
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

// --- Dynamic Metadata Generation ---
type Props = {
  params: {}; // No dynamic route params for this page
  searchParams: { q?: string; tags?: string };
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const query = searchParams.q;
  const tags = searchParams.tags;

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
  const query = searchParams?.q || "";
  const { results, error } = await performSearch(query);

  console.log("results being passed to page component:", results);
  console.log("error being passed to page component:", error);

  let searchResults: SearchResultGame[] = [];
  let searchError: string | null = null;
  let popularCategories: string[] = [];
  let recentGames: DisplayGame[] = [];
  let popularGames: DisplayGame[] = [];

  const searchQuery = searchParams?.q || "";
  const tagsSearch = searchParams?.tags;

  if (searchQuery || tagsSearch) {
    const searchData = await performSearch(searchQuery, tagsSearch);
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

  const currentSearchTags = searchParams?.tags || "";

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
            defaultValue={query}
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

            {searchResults.length === 0 && !searchError && (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No games found matching "{searchQuery}"
                  {tagsSearch && ` with tags "${tagsSearch}"`}
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
            <div className="space-y-4">
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
          </div>
        )}
      </Suspense>
    </div>
  );
}
