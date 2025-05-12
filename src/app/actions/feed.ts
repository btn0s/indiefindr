"use server";

import { createClient } from "@/utils/supabase/server";
import { db, schema } from "@/db";
import {
  eq,
  sql,
  notInArray,
  desc,
  avg,
  count,
  inArray,
  isNotNull,
  and,
} from "drizzle-orm";
import { getLibraryGameIds } from "./library"; // Import action from the same directory

// Define the structure of the game data returned by the feed
// Match this with what GameCard expects, adding/removing fields as needed
export interface FeedGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null; // Add steamAppid
  tags: string[] | null; // Add tags array
  // Add other necessary fields like imageUrl, genres, etc.
}

// Define a structure for the action's return value
interface FeedResult {
  success: boolean;
  data?: FeedGame[];
  message?: string;
  error?: string; // Keep error for library fetch compatibility
}

const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 1; // Use average even for 1 game
const FEED_SIZE = 12; // Number of recommendations to return
const VECTOR_DIMENSIONS = 1536; // Match schema

/**
 * Calculates the average of multiple vectors.
 */
function calculateAverageVector(vectors: number[][]): number[] | null {
  if (!vectors || vectors.length === 0) return null;
  const numVectors = vectors.length;
  const firstVector = vectors[0];
  if (!firstVector) return null;
  const numDimensions = firstVector.length;

  const average = new Array(numDimensions).fill(0);

  for (const vector of vectors) {
    if (vector && vector.length === numDimensions) {
      for (let i = 0; i < numDimensions; i++) {
        average[i] += vector[i];
      }
    }
  }

  for (let i = 0; i < numDimensions; i++) {
    average[i] /= numVectors;
  }

  return average;
}

/**
 * Fetches personalized game recommendations or recent games as fallback.
 */
export async function getPersonalizedFeed(): Promise<FeedResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in getPersonalizedFeed:", authError);
    // For non-logged-in users, maybe return popular games or an empty feed?
    // For now, return error
    return { success: false, message: "Authentication required." };
  }

  // 1. Get user's library
  const libraryResult = await getLibraryGameIds(); // This returns { success, data?, error? }
  if (!libraryResult.success || !libraryResult.data) {
    return {
      success: false,
      message:
        "Could not retrieve user library." +
        (libraryResult.error ? ` (${libraryResult.error})` : ""),
    };
  }
  const libraryGameIds = libraryResult.data;

  try {
    let recommendations: FeedGame[] = [];
    const excludedIds = libraryGameIds.length > 0 ? libraryGameIds : [-1]; // Handle empty library for notInArray

    // --- Strategy 1: Average Embedding Similarity Search ---
    if (libraryGameIds.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING) {
      console.log(
        `User ${user.id} library size ${libraryGameIds.length}, attempting average embedding search.`
      );

      // 1. Fetch embeddings for library games
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

      // 2. Calculate average vector
      const averageVector = calculateAverageVector(validEmbeddings);

      if (averageVector) {
        console.log(`Calculated average vector for user ${user.id}.`);
        // 3. Perform similarity search
        recommendations = await db
          .select({
            id: schema.externalSourceTable.id,
            title: schema.externalSourceTable.title,
            shortDescription: schema.externalSourceTable.descriptionShort,
            steamAppid: schema.externalSourceTable.steamAppid,
            tags: schema.externalSourceTable.tags, // Select tags
          })
          .from(schema.externalSourceTable)
          .where(
            and(
              notInArray(schema.externalSourceTable.id, excludedIds),
              isNotNull(schema.externalSourceTable.embedding)
            )
          )
          .orderBy(
            sql`embedding <=> '${sql.raw(JSON.stringify(averageVector))}'`
          )
          .limit(FEED_SIZE);

        console.log(
          `Found ${recommendations.length} recommendations via average embedding for user ${user.id}.`
        );
      } else {
        console.log(
          `Could not calculate average vector for user ${user.id} (not enough valid embeddings?).`
        );
      }
    }

    // --- Strategy 2: Fallback to Recently Added Games ---
    if (recommendations.length === 0) {
      if (libraryGameIds.length > 0) {
        console.log(
          `User ${user.id} - No recommendations found via similarity, falling back to recent games.`
        );
      } else {
        console.log(
          `User ${user.id} has empty library, fetching recent games.`
        );
      }

      recommendations = await db
        .select({
          id: schema.externalSourceTable.id,
          title: schema.externalSourceTable.title,
          shortDescription: schema.externalSourceTable.descriptionShort,
          steamAppid: schema.externalSourceTable.steamAppid,
          tags: schema.externalSourceTable.tags, // Select tags
        })
        .from(schema.externalSourceTable)
        .where(notInArray(schema.externalSourceTable.id, excludedIds))
        .orderBy(desc(schema.externalSourceTable.createdAt)) // Order by most recent
        .limit(FEED_SIZE);

      console.log(
        `Found ${recommendations.length} recent games as fallback for user ${user.id}.`
      );
    }

    console.log(
      `Returning ${recommendations.length} total recommendations for user ${user.id}`
    );
    return { success: true, data: recommendations };
  } catch (error: any) {
    console.error(
      `Error fetching personalized feed for user ${user.id}:`,
      error
    );
    return {
      success: false,
      message: `Failed to fetch feed: ${error.message}`,
    };
  }

  // Fallback return to satisfy TypeScript compiler - should be unreachable
  return { success: false, message: "An unexpected error occurred." };
}
