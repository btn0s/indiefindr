import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db, schema } from "@/db";
import { eq, inArray, sql, and, isNotNull, notInArray } from "drizzle-orm";

// Define the structure of the game data we want to return in the feed
// This could eventually go into a shared types file (src/types/game.ts?)
interface FeedGame {
  id: number;
  title: string | null;
  externalId: string;
  steamAppid: string | null;
  descriptionShort: string | null;
  // Potentially add image URLs, genres etc. later
}

// Type for the recommendation result including distance
type RecommendationResult = FeedGame & { distance: number };

export async function GET(request: Request) {
  // Use the reusable server client
  const supabase = await createClient();

  try {
    // 1. Get authenticated user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[API /feed] Supabase session error:", sessionError);
      return NextResponse.json(
        { error: "Error fetching user session" },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`[API /feed] Generating feed for user: ${userId}`);

    // 2. Fetch user's library game IDs
    const libraryItems = await db.query.libraryTable.findMany({
      where: eq(schema.libraryTable.userId, userId),
      columns: { gameRefId: true },
    });

    const libraryGameIds = libraryItems.map((item) => item.gameRefId);

    // --- Early Exit / Alternative Feed Logic ---
    if (libraryGameIds.length === 0) {
      console.log(
        `[API /feed] User ${userId} has an empty library. Returning generic feed (TODO).`
      );
      // TODO: Implement generic feed (e.g., recently added, featured)
      const genericFeed: FeedGame[] = []; // Placeholder
      return NextResponse.json(genericFeed);
    }

    console.log(
      `[API /feed] User ${userId} library contains IDs: ${libraryGameIds.join(", ")}`
    );

    // 3. Fetch embeddings for library games
    const libraryEmbeddings = await db
      .select({
        embedding: schema.externalSourceTable.embedding,
      })
      .from(schema.externalSourceTable)
      .where(inArray(schema.externalSourceTable.id, libraryGameIds))
      .execute();

    // Filter out null embeddings and ensure we have some to work with
    const validEmbeddings = libraryEmbeddings
      .map((item) => item.embedding)
      .filter((e): e is number[] => e !== null && e.length > 0);

    if (validEmbeddings.length === 0) {
      console.log(
        `[API /feed] No valid embeddings found for library games of user ${userId}. Returning generic feed (TODO).`
      );
      // TODO: Implement generic feed
      const genericFeed: FeedGame[] = []; // Placeholder
      return NextResponse.json(genericFeed);
    }

    // 4. Calculate average embedding (simple strategy)
    const avgEmbedding = validEmbeddings[0]; // TODO: Actually average the embeddings
    // For now, just use the first embedding found
    console.log(
      `[API /feed] Using embedding from game ID ${libraryItems[0].gameRefId} as base for similarity.`
    );

    // 5. Perform Vector Similarity Search
    const distanceSql = sql<number>`${schema.externalSourceTable.embedding} <=> ${JSON.stringify(avgEmbedding)}`;

    // Use Drizzle `and` and `notInArray` helpers for combining conditions
    const recommendations = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        distance: distanceSql,
      })
      .from(schema.externalSourceTable)
      .where(
        and(
          // Exclude games already in the library
          notInArray(schema.externalSourceTable.id, libraryGameIds),
          // Exclude games without embeddings
          isNotNull(schema.externalSourceTable.embedding)
        )
      )
      .orderBy(distanceSql) // Order by cosine distance (lower is more similar)
      .limit(10) // Limit to top 10 recommendations
      .execute();

    console.log(
      `[API /feed] Found ${recommendations.length} recommendations for user ${userId}.`
    );

    // 6. Format and return results (with type annotation for rec)
    const feedResults: FeedGame[] = recommendations.map(
      (rec: RecommendationResult) => ({
        id: rec.id,
        title: rec.title,
        externalId: rec.externalId,
        steamAppid: rec.steamAppid,
        descriptionShort: rec.descriptionShort,
      })
    );

    return NextResponse.json(feedResults);
  } catch (error: any) {
    console.error("[API /feed] Error generating feed:", error);
    return NextResponse.json(
      {
        error: "Internal server error generating feed.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
