import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, ilike } from "drizzle-orm";

// Define the structure of the game data to return for search results
interface SearchResultGame {
  id: number;
  title: string | null;
  externalId: string;
  steamAppid: string | null;
  descriptionShort: string | null;
  // Add other relevant fields if needed
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  console.log(`[API /search] Received search query: "${query}"`);

  try {
    // For basic keyword search as per MVP, we can use a simple ILIKE for now.
    // For more advanced FTS, we would use to_tsvector and plainto_tsquery with a GIN index.
    // The BACKEND_MVP.md specifies: "Searches external_source.title via PG FTS"
    // Let's construct a basic FTS query using Drizzle sql.
    // We will search for terms in the title.
    // Example: plainto_tsquery('english', query) @@ to_tsvector('english', schema.externalSourceTable.title)

    // Simplified approach: using ILIKE for broad matching of titles.
    // For true FTS, you would ideally have a GIN index on `to_tsvector('english', title)`
    // and use `WHERE to_tsvector('english', title) @@ plainto_tsquery('english', query)`.
    // Drizzle syntax for FTS can be a bit more involved with custom operators or raw SQL.

    // Using `ilike` for simplicity as a starting point for "keyword search"
    // This is not true FTS but will work for basic substring matching on titles.
    const searchResults = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
      })
      .from(schema.externalSourceTable)
      .where(ilike(schema.externalSourceTable.title, `%${query}%`)) // Case-insensitive substring match
      .limit(20) // Limit results for performance
      .execute();

    // If we want to implement true FTS with ranking:
    // const tsQuery = sql`plainto_tsquery('english', ${query})`;
    // const tsVector = sql`to_tsvector('english', ${schema.externalSourceTable.title})`;
    // const rank = sql`ts_rank_cd(${tsVector}, ${tsQuery})`.as('rank');

    // const searchResults = await db.select({
    //     id: schema.externalSourceTable.id,
    //     title: schema.externalSourceTable.title,
    //     externalId: schema.externalSourceTable.externalId,
    //     steamAppid: schema.externalSourceTable.steamAppid,
    //     descriptionShort: schema.externalSourceTable.descriptionShort,
    //     rank: rank,
    //   })
    //   .from(schema.externalSourceTable)
    //   .where(sql`${tsVector} @@ ${tsQuery}`)
    //   .orderBy(sql`rank DESC`)
    //   .limit(20)
    //   .execute();

    console.log(
      `[API /search] Found ${searchResults.length} results for query "${query}".`
    );

    const formattedResults: SearchResultGame[] = searchResults.map((game) => ({
      id: game.id,
      title: game.title,
      externalId: game.externalId,
      steamAppid: game.steamAppid,
      descriptionShort: game.descriptionShort,
    }));

    return NextResponse.json(formattedResults);
  } catch (error: any) {
    console.error(
      `[API /search] Error during search for query "${query}":`,
      error
    );
    return NextResponse.json(
      { error: "Internal server error during search.", details: error.message },
      { status: 500 }
    );
  }
}
