"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { DefaultGameService } from "@/services/game-service";
import type { GameCardViewModel } from "@/services/game-service";

// Define the shape of the state returned by the action
export interface SubmitGameState {
  status: "idle" | "loading" | "success" | "error" | "exists";
  message: string;
  gameId?: string; // For "exists" status (DB ID of existing game)
  submittedGameData?: GameCardViewModel; // For "success" or "exists" status
}

const SteamUrlSchema = z
  .string({
    required_error: "Steam URL is required.",
    invalid_type_error: "Steam URL must be a string.",
  })
  .url("Please provide a valid URL.")
  .regex(
    /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/,
    "Invalid Steam App URL format. Should be like: https://store.steampowered.com/app/YOUR_APP_ID"
  );

const gameService = new DefaultGameService(); // Instantiate service

export async function submitGameAction(
  prevState: SubmitGameState | null,
  formData: FormData
): Promise<SubmitGameState> {
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

  // 1. Validate Input (Steam URL)
  const validationResult = SteamUrlSchema.safeParse(steamUrl);

  if (!validationResult.success) {
    // Get the first error message for simplicity
    const firstError =
      validationResult.error.errors[0]?.message || "Invalid Steam URL.";
    return {
      status: "error",
      message: firstError,
    };
  }

  const match = validationResult.data.match(/\/app\/(\d+)/);
  const appIdString = match ? match[1] : null;

  if (!appIdString) {
    // This case should ideally be caught by the regex, but defensive check.
    return { status: "error", message: "Could not extract AppID from URL." };
  }

  console.log(
    `[Submit Action] User ${user.id} attempting to submit Steam AppID: ${appIdString}`
  );

  try {
    // Call the game service method
    const serviceResult = await gameService.submitNewGameBySteamAppId(
      user.id,
      appIdString
    );

    // Adapt serviceResult to SubmitGameState
    if (serviceResult.status === "success") {
      return {
        status: "success",
        message: serviceResult.message,
        submittedGameData: serviceResult.game,
      };
    } else if (serviceResult.status === "exists") {
      return {
        status: "exists",
        message: serviceResult.message,
        gameId: serviceResult.gameId, // Pass through the DB ID of the existing game
        submittedGameData: serviceResult.game, // Pass through existing game data as ViewModel
      };
    } else {
      // status === "error"
      return {
        status: "error",
        message: serviceResult.message, // Message from service (could be Steam API error or other)
      };
    }
  } catch (error: any) {
    // This catch block is for unexpected errors within the action itself,
    // not errors handled and returned by the service.
    console.error(
      `[Submit Action] Unexpected error for AppID ${appIdString}:`,
      error
    );
    return {
      status: "error",
      message: "An unexpected internal error occurred. Please try again.",
    };
  }
}
