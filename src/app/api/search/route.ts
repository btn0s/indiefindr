import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { generateEmbedding } from "@/lib/embeddings";
import { sql, and } from "drizzle-orm";

const SEARCH_LIMIT = 10; // Limit the number of search results
const DISTANCE_THRESHOLD = 0.7; // Maximum distance for a result to be considered relevant

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: 'Missing search query parameter "q"' },
      { status: 400 }
    );
  }

  try {
    // 1. Generate embedding for the user query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Prepare the query embedding string for the SQL query
    const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

    // 3. Perform vector similarity search using Drizzle's sql helper
    // We use the cosine distance operator (<=>)
    // Lower distance means higher similarity
    const searchResults = await db
      .select({
        id: schema.finds.id,
        // Use sql template to safely access JSONB fields if needed for specific querying,
        // but select the whole report object for the component
        // gameName: sql<string>`${schema.finds.report}->>'gameName'`,
        // summary: sql<string>`${schema.finds.report}->>'overallReportSummary'`,
        report: schema.finds.report, // Select the full report object
        createdAt: schema.finds.createdAt, // Select createdAt
        // Calculate the distance (lower is better)
        distance: sql<number>`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector`,
      })
      .from(schema.finds)
      .where(
        and(
          sql`${schema.finds.vectorEmbedding} IS NOT NULL`, // Only search items with embeddings
          sql`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector < ${DISTANCE_THRESHOLD}` // Filter by distance threshold
        )
      )
      .orderBy(
        sql`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector ASC`
      ) // Order by similarity (ascending distance)
      .limit(SEARCH_LIMIT);

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error("Search API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Search failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
