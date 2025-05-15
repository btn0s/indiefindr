"use server";

import { z } from "zod";
import { db, schema } from "@/db"; // Import db and schema
import { eq } from "drizzle-orm"; // Import eq operator
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment"; // Import enrichment function
import { createClient } from "@/utils/supabase/server"; // Import createClient for auth
import { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // <-- Import Repository
import { DefaultGameService } from "@/services/game-service"; // <-- Import GameService
import type { GameCardViewModel } from "@/services/game-service"; // <-- Import GameCardViewModel

// Define the structure needed for the GameCard
// This interface can be removed as we will use GameCardViewModel
/*
interface GameCardGameData {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}
*/

// Define the shape of the state returned by the action
interface SubmitGameState {
  status: "idle" | "loading" | "success" | "error" | "exists";
  message: string;
  gameId?: string; // For "exists" status
  existingGameTitle?: string | null; // For "exists" status
  submittedGameData?: GameCardViewModel; // <-- Use GameCardViewModel
}

const SteamUrlSchema = z
  .string()
  .url()
  .regex(
    /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/,
    "Invalid Steam App URL format"
  );

export async function submitGameAction(
  // Initial state can be idle
  prevState: SubmitGameState | null, // Allow null for initial call
  formData: FormData
): Promise<SubmitGameState> {
  // Get the authenticated user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You must be logged in to submit games.",
    };
  }

  const steamUrl = formData.get("steamUrl") as string;

  // 1. Validate Input
  const validatedFields = SteamUrlSchema.safeParse(steamUrl);

  if (!validatedFields.success) {
    return {
      status: "error",
      message: "Please provide a valid Steam App Store URL.",
    };
  }

  const match = validatedFields.data.match(/\/app\/(\d+)/);
  // Ensure appId is treated consistently, Steam API uses number, DB might use string or number
  const appIdNumber = match ? parseInt(match[1], 10) : null;
  const appIdString = appIdNumber ? appIdNumber.toString() : null;

  if (!appIdNumber || !appIdString) {
    return { status: "error", message: "Could not extract AppID from URL." };
  }

  console.log(`[Submit Action] Validated AppID: ${appIdString}`);

  const profile = await db.query.profilesTable.findFirst({
    where: eq(schema.profilesTable.id, user.id),
  });

  if (!profile) {
    return { status: "error", message: "User profile not found" };
  }

  // Validate Steam AppID format (simple numeric check)
  if (!/^[0-9]+$/.test(appIdString)) {
    return { status: "error", message: "Invalid Steam AppID format." };
  }

  try {
    // Instantiate repository and service
    const gameRepository = new DrizzleGameRepository();
    const gameService = new DefaultGameService();

    // Check if the game already exists (by steam_appid, which is unique in gamesTable)
    const existingGame = await gameRepository.getBySteamAppId(appIdString);

    if (existingGame) {
      console.log(
        `[Submit Action] Game found in DB: ID ${existingGame.id}, Title: ${existingGame.title}`
      );
      // Transform existing game to ViewModel for consistency if needed, though only title/id used here
      return {
        status: "exists",
        message: `"${existingGame.title || "This game"}" is already in IndieFindr!`,
        gameId: existingGame.id.toString(), // Provide the internal DB ID
        existingGameTitle: existingGame.title, // Pass the title for the link
      };
    }

    // 3. If game doesn't exist, call enrichment worker with user ID
    console.log(
      `[Submit Action] Game not found. Triggering enrichment for AppID: ${appIdString}`
    );
    await enrichSteamAppId(appIdString, user.id);

    // If enrichSteamAppId completes, fetch the data needed for the card
    console.log(
      `[Submit Action] Enrichment successful for AppID: ${appIdString}. Fetching data for card.`
    );
    // Fetch the newly submitted game - repository method should return Game or GameWithSubmitter
    const newlySubmittedGameFromRepo =
      await gameRepository.getBySteamAppId(appIdString);

    if (!newlySubmittedGameFromRepo) {
      // Should not happen if enrichment just succeeded, but handle defensively
      console.error(
        `[Submit Action] CRITICAL: Could not find game ${appIdString} immediately after enrichment.`
      );
      return {
        status: "error",
        message:
          "Game submitted but failed to retrieve details. Please check back later.",
      };
    }

    // Map DB data to GameCardGameData structure
    // Transform using GameService
    const gameCardData = gameService.toGameCardViewModel(
      newlySubmittedGameFromRepo
    );

    return {
      status: "success",
      message: "Game submitted successfully!", // Keep a simple message
      submittedGameData: gameCardData, // Include the game data
    };
  } catch (error: any) {
    console.error(
      `[Submit Action] Error during submission/enrichment for AppID ${appIdString}:`,
      error
    );
    // Check if the error came from the enrichment step specifically
    if (error.message?.includes("Steam API")) {
      return {
        status: "error",
        message:
          "Could not fetch details from Steam. The game might not exist or the API is down.",
      };
    }
    return {
      status: "error",
      message:
        "Failed to submit game due to an internal error. Please try again.",
    };
  }
}
