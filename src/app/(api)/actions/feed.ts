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
import { DefaultGameService } from "@/services/game-service"; // <-- Import GameService
import type { GameCardViewModel } from "@/services/game-service"; // <-- Import GameCardViewModel

// Define the structure of the game data returned by the feed
// This FeedGame interface can be removed if all transformations go through GameService
// and FeedResult directly uses GameCardViewModel[].
/*
export interface FeedGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null; 
  tags: string[] | null; 
  rawData?: any | null; 
  createdAt?: Date | string | null; // <-- Added for initial step if not using service
}
*/

// Define a structure for the action's return value
interface FeedResult {
  success: boolean;
  data?: GameCardViewModel[]; // <-- Use GameCardViewModel
  message?: string;
  error?: string; // Keep error for library fetch compatibility
}

const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 1;
const FEED_SIZE = 12;
const VECTOR_DIMENSIONS = 1536;

const gameService = new DefaultGameService(); // <-- Instantiate GameService

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
    let rawRecommendations: any[] = []; // Keep type flexible before transformation
    const excludedIds = libraryGameIds.length > 0 ? libraryGameIds : [-1];

    // --- Strategy 1: Average Embedding Similarity Search ---
    if (libraryGameIds.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING) {
      console.log(
        `User ${user.id} library size ${libraryGameIds.length}, attempting average embedding search.`
      );

      // 1. Fetch embeddings for library games
      const libraryEmbeddingsResult = await db
        .select({ embedding: schema.gamesTable.embedding })
        .from(schema.gamesTable)
        .where(
          and(
            inArray(schema.gamesTable.id, libraryGameIds),
            isNotNull(schema.gamesTable.embedding)
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
        rawRecommendations = await db
          .select({
            // Select all fields required by Game type (which GameService expects)
            // or at least all fields that GameCardViewModel needs directly or indirectly from rawData
            id: schema.gamesTable.id,
            title: schema.gamesTable.title,
            descriptionShort: schema.gamesTable.descriptionShort,
            descriptionDetailed: schema.gamesTable.descriptionDetailed, // GameService might use this as fallback
            steamAppid: schema.gamesTable.steamAppid,
            tags: schema.gamesTable.tags,
            genres: schema.gamesTable.genres, // GameService uses this
            rawData: schema.gamesTable.rawData,
            createdAt: schema.gamesTable.createdAt, // <-- SELECT createdAt
            developer: schema.gamesTable.developer, // For GameProfileViewModel, but good to have
            platform: schema.gamesTable.platform, // Base Game fields
            externalId: schema.gamesTable.externalId,
            embedding: schema.gamesTable.embedding, // Base Game fields
            enrichmentStatus: schema.gamesTable.enrichmentStatus, // Base Game fields
            isFeatured: schema.gamesTable.isFeatured, // Base Game fields
            lastFetched: schema.gamesTable.lastFetched, // Base Game fields
            foundBy: schema.gamesTable.foundBy, // For GameWithSubmitter, GameService handles it
            // Ensure all fields from schema.gamesTable.$inferSelect are here if GameService needs full Game type
          })
          .from(schema.gamesTable)
          .where(
            and(
              notInArray(schema.gamesTable.id, excludedIds),
              isNotNull(schema.gamesTable.embedding)
            )
          )
          .orderBy(
            sql`embedding <=> '${sql.raw(JSON.stringify(averageVector))}'`
          )
          .limit(FEED_SIZE);

        console.log(
          `Found ${rawRecommendations.length} recommendations via average embedding for user ${user.id}.`
        );
      } else {
        console.log(
          `Could not calculate average vector for user ${user.id} (not enough valid embeddings?).`
        );
      }
    }

    // --- Strategy 2: Fallback to Recently Added Games ---
    if (rawRecommendations.length === 0) {
      if (libraryGameIds.length > 0) {
        console.log(
          `User ${user.id} - No recommendations found via similarity, falling back to recent games.`
        );
      } else {
        console.log(
          `User ${user.id} has empty library, fetching recent games.`
        );
      }

      rawRecommendations = await db
        .select({
          // Select all fields required by Game type (as above)
          id: schema.gamesTable.id,
          title: schema.gamesTable.title,
          descriptionShort: schema.gamesTable.descriptionShort,
          descriptionDetailed: schema.gamesTable.descriptionDetailed,
          steamAppid: schema.gamesTable.steamAppid,
          tags: schema.gamesTable.tags,
          genres: schema.gamesTable.genres,
          rawData: schema.gamesTable.rawData,
          createdAt: schema.gamesTable.createdAt, // <-- SELECT createdAt
          developer: schema.gamesTable.developer,
          platform: schema.gamesTable.platform,
          externalId: schema.gamesTable.externalId,
          embedding: schema.gamesTable.embedding,
          enrichmentStatus: schema.gamesTable.enrichmentStatus,
          isFeatured: schema.gamesTable.isFeatured,
          lastFetched: schema.gamesTable.lastFetched,
          foundBy: schema.gamesTable.foundBy,
        })
        .from(schema.gamesTable)
        .where(notInArray(schema.gamesTable.id, excludedIds))
        .orderBy(desc(schema.gamesTable.createdAt)) // Order by most recent
        .limit(FEED_SIZE);

      console.log(
        `Found ${rawRecommendations.length} recent games as fallback for user ${user.id}.`
      );
    }

    // Transform data using GameService
    // Note: The input to toGameCardViewModels expects (Game | GameWithSubmitter)[]
    // Our db.select returns an array of objects matching the selection.
    // We need to ensure these objects are compatible with the `Game` type or cast them.
    // For simplicity, if we selected all fields of gamesTable, it matches `Game`.
    // If `foundBy` is used by GameService to fetch submitter details, that's internal to it or GameRepository.
    // Here, we provide data that includes `foundBy` if available, for GameService to potentially use.
    const transformedRecommendations: GameCardViewModel[] =
      gameService.toGameCardViewModels(rawRecommendations as any[]);
    // Using as any[] temporarily, ideally ensure rawRecommendations matches (Game | GameWithSubmitter)[]
    // If GameRepository is used within GameService to get GameWithSubmitter, then this cast might be fine
    // if rawRecommendations just contains Game objects.

    console.log(
      `Returning ${transformedRecommendations.length} total recommendations for user ${user.id}`
    );
    return { success: true, data: transformedRecommendations };
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
