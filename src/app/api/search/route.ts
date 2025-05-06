import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { generateEmbedding } from "@/lib/embeddings";
import { sql, and, or, ilike, asc } from "drizzle-orm";

// Add type for the report structure within the JSONB column
import type { DetailedIndieGameReport } from "@/schema";

const SEARCH_LIMIT = 10; // Limit the number of search results
const DISTANCE_THRESHOLD = 0.7; // Slightly increase threshold to allow more semantic matches

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    // Added trim() check
    return NextResponse.json(
      { error: 'Missing or empty search query parameter "q"' },
      { status: 400 }
    );
  }

  const trimmedQuery = query.trim(); // Use trimmed query

  try {
    // 1. Generate embedding for the user query
    const queryEmbedding = await generateEmbedding(trimmedQuery);
    const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

    // 2. Define conditions for keyword search
    // We need to safely access JSONB fields and check if the tags array contains the query
    const keywordConditions = or(
      // Case-insensitive search on game name
      ilike(sql`${schema.finds.report}->>'gameName'`, `%${trimmedQuery}%`),
      // Check if genresAndTags array (treated as text) contains the query word(s)
      // Using @@ plainto_tsquery for basic text search on tags converted to text
      // Note: This is a basic check. For more complex tag searching, a dedicated FTS index might be better.
      sql`(${schema.finds.report}->>'genresAndTags')::text @@ plainto_tsquery('english', ${trimmedQuery})`
      // Alternative/Simpler text check (less efficient than FTS):
      // ilike(sql`(${schema.finds.report}->>'genresAndTags')::text`, `%${trimmedQuery}%`)
    );

    // 3. Define condition for vector search
    const vectorCondition = and(
      sql`${schema.finds.vectorEmbedding} IS NOT NULL`,
      sql`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector < ${DISTANCE_THRESHOLD}`
    );

    // 4. Combine conditions: Find matches from EITHER keyword OR vector search
    const combinedCondition = or(keywordConditions, vectorCondition);

    // 5. Perform the combined search
    const searchResults = await db
      .select({
        id: schema.finds.id,
        report: schema.finds.report,
        createdAt: schema.finds.createdAt,
        rawSteamJson: schema.finds.rawSteamJson,
        // Calculate distance for sorting (will be null if only keyword match)
        distance: sql<
          number | null
        >`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector`.as(
          "distance"
        ),
        // Add a flag to know if it was a keyword match (useful for potential re-ranking)
        isKeywordMatch: sql<boolean>`${keywordConditions}`.as(
          "is_keyword_match"
        ),
      })
      .from(schema.finds)
      .where(combinedCondition)
      .orderBy(
        // Prioritize keyword matches, then sort by vector distance
        sql`CASE WHEN ${keywordConditions} THEN 0 ELSE 1 END ASC`, // Keyword matches first
        sql`(${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector) ASC NULLS LAST` // Then sort by distance
      )
      .limit(SEARCH_LIMIT);

    // 6. Post-process results (optional, e.g., removing duplicates if necessary, though ORDER BY should handle priority)
    // The current query returns a single list prioritized by keyword match then vector similarity.

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
