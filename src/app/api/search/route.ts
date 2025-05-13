import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, ilike, or } from "drizzle-orm";

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
    // For more effective search, we will:
    // 1. Use ILIKE on both title and description
    // 2. If no results, try a more flexible match with individual keywords
    // 3. Limit results but return a reasonable number for the UI

    const queryTerms = query.trim().split(/\s+/).filter(Boolean);

    // First, try the most specific search (exact phrase in title or description)
    let searchResults = await db
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

    // If no results, try a more flexible match with individual keywords
    if (searchResults.length === 0 && queryTerms.length > 1) {
      const conditions = queryTerms.map((term) =>
        or(
          ilike(schema.externalSourceTable.title, `%${term}%`),
          ilike(schema.externalSourceTable.descriptionShort, `%${term}%`)
        )
      );

      searchResults = await db
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

    // If we have a proper GIN index setup on the database side, we could use FTS:
    // const tsVector = sql`to_tsvector('english', coalesce(${schema.externalSourceTable.title},'') || ' ' || coalesce(${schema.externalSourceTable.descriptionShort},''))`;
    // const tsQuery = sql`plainto_tsquery('english', ${query})`;
    // const rank = sql`ts_rank_cd(${tsVector}, ${tsQuery})`.as('rank');
    //
    // const searchResults = await db.select({
    //   id: schema.externalSourceTable.id,
    //   title: schema.externalSourceTable.title,
    //   externalId: schema.externalSourceTable.externalId,
    //   steamAppid: schema.externalSourceTable.steamAppid,
    //   descriptionShort: schema.externalSourceTable.descriptionShort,
    //   rank: rank,
    // })
    // .from(schema.externalSourceTable)
    // .where(sql`${tsVector} @@ ${tsQuery}`)
    // .orderBy(sql`rank DESC`)
    // .limit(20)
    // .execute();

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
