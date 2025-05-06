import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
// Use OpenAI text embedding
import { generateEmbedding } from "@/lib/embeddings";
import { sql, and, or, ilike, asc } from "drizzle-orm";

// Remove Transformers.js imports and setup
// import {
//   pipeline,
//   env,
//   type PipelineType,
// } from "@xenova/transformers";
// env.allowLocalModels = false;
// env.useFSCache = true;

// Add type for the report structure within the JSONB column
import type { DetailedIndieGameReport } from "@/schema";

// Remove CLIP Singleton
// class ClipSingleton { ... }

const SEARCH_LIMIT = 10;
// Reset threshold for text embeddings
const DISTANCE_THRESHOLD = 0.8;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty search query parameter "q"' },
      { status: 400 }
    );
  }

  const trimmedQuery = query.trim();

  try {
    // 1. Generate OpenAI text embedding for the user query
    console.log(
      `[Search] Generating OpenAI text embedding for query: "${trimmedQuery}"`
    );
    const queryEmbedding = await generateEmbedding(trimmedQuery);

    if (!queryEmbedding) {
      console.error(
        `[Search] Failed to generate OpenAI embedding for query: ${trimmedQuery}`
      );
      return NextResponse.json(
        { error: "Failed to process search query embedding." },
        { status: 500 }
      );
    }
    console.log(
      `[Search] OpenAI Query Embedding generated (Dim: ${queryEmbedding.length})`
    );
    const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

    // 2. Define conditions for keyword search
    const nameKeywordCondition = ilike(
      sql`${schema.finds.report}->>'gameName'`,
      `%${trimmedQuery}%`
    );
    const tagKeywordCondition = sql`(${schema.finds.report}->>'genresAndTags')::text @@ plainto_tsquery('english', ${trimmedQuery})`;
    const descriptionKeywordCondition = sql`(${schema.finds.report}->>'description')::text @@ plainto_tsquery('english', ${trimmedQuery})`;

    // Add ILIKE conditions for tags and description as well
    const tagIlikeCondition = ilike(
      sql`${schema.finds.report}->>'genresAndTags'`,
      `%${trimmedQuery}%`
    );
    const descriptionIlikeCondition = ilike(
      sql`${schema.finds.report}->>'description'`,
      `%${trimmedQuery}%`
    );

    // Combine ALL keyword conditions (ILIKE on name/tags/desc OR plainto_tsquery on tags/desc)
    const combinedKeywordConditions = or(
      nameKeywordCondition,
      tagKeywordCondition,
      descriptionKeywordCondition,
      tagIlikeCondition, // Add ILIKE check for tags
      descriptionIlikeCondition // Add ILIKE check for description
    );

    // 3. Define condition for vector search (using OpenAI embeddings)
    const vectorCondition = and(
      sql`${schema.finds.vectorEmbedding} IS NOT NULL`,
      // Using cosine distance: <=>
      sql`${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector < ${DISTANCE_THRESHOLD}`
    );

    // 4. Combine conditions: Semantically close (text-to-caption) OR keyword match
    const combinedCondition = or(vectorCondition, combinedKeywordConditions);
    // TEMPORARY: Test ONLY keyword conditions
    // const combinedCondition = combinedKeywordConditions;

    // 5. Perform the combined search
    console.log("[Search] Performing database query...");
    const searchResults = await db
      .select({
        id: schema.finds.id,
        report: schema.finds.report,
        createdAt: schema.finds.createdAt,
        rawSteamJson: schema.finds.rawSteamJson,
        rawReviewJson: schema.finds.rawReviewJson,
        distance: sql<
          number | null
          // Calculate cosine distance for vector(1536)
        >`(1 - (${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector))`.as(
          "distance"
        ),
        isKeywordMatch: sql<boolean>`${combinedKeywordConditions}`.as(
          "is_keyword_match"
        ),
        isTagMatch: sql<boolean>`${tagKeywordCondition}`.as("is_tag_match"),
      })
      .from(schema.finds)
      .where(combinedCondition)
      .orderBy(
        // Prioritize keyword matches first
        sql`CASE WHEN ${combinedKeywordConditions} THEN 0 ELSE 1 END ASC`,
        // Then sort by vector distance (ascending)
        sql`(${schema.finds.vectorEmbedding} <=> ${queryEmbeddingString}::vector) ASC NULLS LAST`
        // Simple order by creation date for now
        // asc(schema.finds.createdAt)
      )
      .limit(SEARCH_LIMIT);

    console.log(`[Search] Found ${searchResults.length} results.`);

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
