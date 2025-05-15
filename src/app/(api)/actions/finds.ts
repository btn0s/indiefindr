"use server";

import { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // <-- Import Repository
import type { GameWithSubmitter } from "@/lib/repositories/game-repository"; // <-- Import GameWithSubmitter
import { DefaultGameService } from "@/services/game-service"; // <-- Import GameService
import type { GameCardViewModel } from "@/services/game-service"; // <-- Import GameCardViewModel

// Define the return type structure, matching GameForGrid from the profile page
// This type can be removed as we will use GameCardViewModel[] in GetGamesFoundByUserResult
/*
type FoundGame = {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  foundByUsername: string | null;
  foundByAvatarUrl: string | null; // Add avatar URL
  rawData?: SteamRawData | null;
};
*/

interface GetGamesFoundByUserResult {
  success: boolean;
  data?: GameCardViewModel[]; // <-- Use GameCardViewModel[]
  error?: string;
}

// Instantiate repository and service outside the function if they don't depend on request-specific data
// or inside if they do (though these current ones don't seem to)
const gameRepository = new DrizzleGameRepository();
const gameService = new DefaultGameService();

export async function getGamesFoundByUser(
  userId: string
): Promise<GetGamesFoundByUserResult> {
  // Basic validation
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  // Optional: Add authentication check if only logged-in users can view finds?
  // const supabase = createClient();
  // const { data: { user }, error: authError } = await supabase.auth.getUser();
  // if (authError || !user) {
  //   return { success: false, error: "Authentication required." };
  // }

  try {
    // Use the repository to get games by user, expecting GameWithSubmitter[]
    // The repository's getByUser method should be designed to fetch all necessary fields for GameWithSubmitter
    const foundGamesFromRepo: GameWithSubmitter[] =
      await gameRepository.getByUser(userId);

    // Transform using GameService
    const transformedGames: GameCardViewModel[] =
      gameService.toGameCardViewModels(foundGamesFromRepo);

    return { success: true, data: transformedGames };
  } catch (error: any) {
    console.error(`Error fetching games found by user ${userId}:`, error);
    return {
      success: false,
      error: `Failed to fetch user's finds: ${error.message}`,
    };
  }
}
