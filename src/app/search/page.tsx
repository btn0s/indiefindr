import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import { ilike, or } from "drizzle-orm";
import { GameCardMini } from "@/components/game-card-mini";

// SearchResultGame interface is defined here as the client component was removed
interface SearchResultGame {
  id: number;
  title: string | null;
  externalId: string;
  steamAppid: string | null;
  descriptionShort: string | null;
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
        })
        .from(schema.externalSourceTable)
        .where(or(...conditions))
        .limit(20)
        .execute();
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

const getSteamImageUrl = (steamAppid: string | null) => {
  return steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppid}/header.jpg`
    : "/placeholder-game.jpg"; // Fallback image
};

const getGameUrl = (id: number, title: string | null) => {
  const slug = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
    : "unknown";
  return `/games/${id}/${slug}`;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q || "";
  const { results, error } = await performSearch(query);

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Discover
        </Link>

        <h1 className="text-3xl font-bold mb-6">Search Games</h1>

        <form method="GET" action="/search" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query} // Use defaultValue for server-rendered input
            placeholder="Search games by title..."
            className="flex-1"
            aria-label="Search games by title"
          />
          <Button type="submit">
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-4 mb-6">
          {error}
        </div>
      )}

      {/* Show no results message only if a query was made and there are no errors */}
      {query && results.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">
            No games found matching "{query}"
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((game) => (
          <GameCardMini
            key={game.id}
            game={{
              id: game.id,
              title: game.title,
              steamAppid: game.steamAppid,
              descriptionShort: game.descriptionShort,
            }}
            detailsLinkHref={getGameUrl(game.id, game.title)}
          />
        ))}
      </div>
    </div>
  );
}
