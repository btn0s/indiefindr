import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db, schema } from "@/db";
import {
  eq,
  inArray,
  sql,
  and,
  isNotNull,
  notInArray,
  desc,
} from "drizzle-orm";
import { getLibraryGameIds } from "@/app/actions/library";
import type { SteamRawData } from "@/types/steam";

const VECTOR_DIMENSIONS = 384; // Assuming this is defined elsewhere, place appropriately
const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 3; // Example value
const DEFAULT_FEED_BATCH_SIZE = 4; // Renamed and updated

interface FeedGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

interface FeedResult {
  success: boolean;
  data?: FeedGame[];
  message?: string;
}

// Helper function (if not already available globally)
function calculateAverageVector(vectors: number[][]): number[] | null {
  if (!vectors || vectors.length === 0) {
    return null;
  }
  const numDimensions = vectors[0].length;
  const sum = new Array(numDimensions).fill(0);
  for (const vector of vectors) {
    if (vector.length === numDimensions) {
      for (let i = 0; i < numDimensions; i++) {
        sum[i] += vector[i];
      }
    }
  }
  return sum.map((s) => s / vectors.length);
}

export async function GET(request: Request): Promise<NextResponse<FeedResult>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in /api/feed:", authError);
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }

  // Get page and limit from query parameters
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(
    searchParams.get("limit") || DEFAULT_FEED_BATCH_SIZE.toString(),
    10
  );
  const offset = (page - 1) * limit;

  // 1. Get user's library
  const libraryResult = await getLibraryGameIds();
  if (!libraryResult.success || !libraryResult.data) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Could not retrieve user library." +
          (libraryResult.error ? ` (${libraryResult.error})` : ""),
      },
      { status: 500 }
    );
  }
  const libraryGameIds = libraryResult.data;

  try {
    let recommendationIds: number[] = [];
    // Ensure excludedIds always has at least one element for notInArray, or handle empty library differently if DB requires
    const excludedIds = libraryGameIds.length > 0 ? libraryGameIds : [-1];

    // 1. Attempt to get recommendations based on average library embedding
    if (libraryGameIds.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING) {
      const libraryEmbeddingsResult = await db
        .select({ embedding: schema.externalSourceTable.embedding })
        .from(schema.externalSourceTable)
        .where(
          and(
            inArray(schema.externalSourceTable.id, libraryGameIds),
            isNotNull(schema.externalSourceTable.embedding)
          )
        );

      const validEmbeddings = libraryEmbeddingsResult
        .map((r) => r.embedding)
        .filter(
          (e): e is number[] => e !== null && e.length === VECTOR_DIMENSIONS
        );

      const averageVector = calculateAverageVector(validEmbeddings);

      if (averageVector) {
        // Step 1a: Get IDs based on vector similarity
        const results = await db
          .select({ id: schema.externalSourceTable.id })
          .from(schema.externalSourceTable)
          .where(
            and(
              notInArray(schema.externalSourceTable.id, excludedIds),
              isNotNull(schema.externalSourceTable.embedding)
            )
          )
          .orderBy(
            sql`(${schema.externalSourceTable.embedding}) <=> ${JSON.stringify(averageVector)}`
          )
          .limit(limit)
          .offset(offset);
        recommendationIds = results.map((r) => r.id);
      }
    }

    // 2. Fallback to newest games if no recommendations found yet
    if (recommendationIds.length === 0) {
      // Step 1b: Get IDs based on creation date (fallback)
      const fallbackResults = await db
        .select({ id: schema.externalSourceTable.id })
        .from(schema.externalSourceTable)
        .where(notInArray(schema.externalSourceTable.id, excludedIds))
        .orderBy(desc(schema.externalSourceTable.createdAt))
        .limit(limit)
        .offset(offset);
      recommendationIds = fallbackResults.map((r) => r.id);
    }

    // 3. Fetch full data for the final list of IDs
    let recommendations: FeedGame[] = [];
    if (recommendationIds.length > 0) {
      const finalResults = await db
        .select({
          id: schema.externalSourceTable.id,
          title: schema.externalSourceTable.title,
          shortDescription: schema.externalSourceTable.descriptionShort,
          steamAppid: schema.externalSourceTable.steamAppid,
          tags: schema.externalSourceTable.tags,
          rawData: schema.externalSourceTable.rawData,
        })
        .from(schema.externalSourceTable)
        .where(inArray(schema.externalSourceTable.id, recommendationIds));

      // Optional: Re-order finalResults based on recommendationIds if needed
      // (Drizzle/DB doesn't guarantee order preservation with inArray)
      const orderMap = new Map(
        recommendationIds.map((id, index) => [id, index])
      );
      recommendations = finalResults
        .map((game) => ({
          ...game,
          rawData: game.rawData as SteamRawData | null, // Cast rawData
        }))
        .sort(
          (a, b) =>
            (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity)
        );
    }

    return NextResponse.json({ success: true, data: recommendations });
  } catch (error: any) {
    console.error(
      `Error fetching personalized feed for user ${user.id} in /api/feed:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch feed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

