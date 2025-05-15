"use server";

import { createClient } from "@/lib/supabase/server";
// db, schema, and specific drizzle operators are no longer needed directly by the action
// The GameService will handle interactions with repositories.
import { DefaultGameService } from "@/lib/services/game-service";
import type { GameCardViewModel } from "@/lib/services/game-service"; 
// getLibraryGameIds action is no longer needed as GameService uses LibraryService internally.

// Define a structure for the action's return value
interface FeedResult {
  success: boolean;
  data?: GameCardViewModel[];
  message?: string;
}

const gameService = new DefaultGameService(); // Instantiate GameService

// The calculateAverageVector function is now a private method in DefaultGameService.

/**
 * Fetches personalized game recommendations or recent games as fallback.
 * This action now delegates the core logic to GameService.
 */
export async function getPersonalizedFeed(): Promise<FeedResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("getPersonalizedFeed Action: User not authenticated.");
    // For non-logged-in users, GameService.getPersonalizedFeedForUser might return a generic feed (e.g. recent) or empty.
    // Or, we can decide here to return an error or a specific public feed.
    // For now, let's try calling the service and let it handle logic for non-specific user if designed to.
    // However, the current service implementation expects a userId. So, we return error.
    return {
      success: false,
      message: "Authentication required for personalized feed.",
    };
  }

  console.log(`getPersonalizedFeed Action: Fetching for user ${user.id}`);

  try {
    // Delegate to the GameService method
    // The FEED_SIZE constant is now managed within the GameService.
    const feedData = await gameService.getPersonalizedFeedForUser(user.id);

    if (!feedData) {
      // Should not happen if service returns [] on error, but defensive
      console.error(
        `getPersonalizedFeed Action: GameService returned undefined for user ${user.id}`
      );
      return { success: false, message: "Failed to retrieve feed data." };
    }

    console.log(
      `getPersonalizedFeed Action: Returning ${feedData.length} items for user ${user.id}`
    );
    return { success: true, data: feedData };
  } catch (error: any) {
    // This catch block is for unexpected errors within the action itself or if GameService throws an unhandled error.
    console.error(
      `getPersonalizedFeed Action: Error for user ${user.id}:`,
      error
    );
    return {
      success: false,
      message:
        error.message ||
        "Failed to fetch personalized feed due to an unexpected error.",
    };
  }
}

// Any other actions in this file should also be refactored or reviewed for redundancy.
// For now, focusing on getPersonalizedFeed.
