"use server";

import { z } from "zod";
import { db, schema } from "@/db"; // Import db and schema
import { eq } from "drizzle-orm"; // Import eq operator
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment"; // Import enrichment function
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type
import { createClient } from "@/utils/supabase/server"; // Import createClient for auth

// Define the structure needed for the GameCard
interface GameCardGameData {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

// Define the shape of the state returned by the action
export interface SubmitGameState {
  status: "success" | "exists" | "error" | "idle";
  message: string;
  gameId?: string; // Keep for the 'exists' case link
  submittedGameData?: GameCardGameData | null; // Add field for success case
  existingGameTitle?: string | null; // Add field for existing game title
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

  try {
    // 2. Check if game exists in DB
    const existingGame = await db.query.externalSourceTable.findFirst({
      where: eq(schema.externalSourceTable.steamAppid, appIdString),
      columns: {
        id: true, // Select only the ID we need for the link/reference
        title: true, // Maybe show the title too
      },
    });

    if (existingGame) {
      console.log(
        `[Submit Action] Game found in DB: ID ${existingGame.id}, Title: ${existingGame.title}`
      );
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
    await enrichSteamAppId(appIdString, user.id); // Pass the user's ID

    // If enrichSteamAppId completes, fetch the data needed for the card
    console.log(
      `[Submit Action] Enrichment successful for AppID: ${appIdString}. Fetching data for card.`
    );
    const newlySubmittedGame = await db.query.externalSourceTable.findFirst({
      where: eq(schema.externalSourceTable.steamAppid, appIdString),
      columns: {
        id: true,
        title: true,
        descriptionShort: true, // Use descriptionShort for shortDescription
        steamAppid: true,
        tags: true,
        rawData: true,
      },
    });

    if (!newlySubmittedGame) {
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
    const gameCardData: GameCardGameData = {
      id: newlySubmittedGame.id,
      title: newlySubmittedGame.title,
      shortDescription: newlySubmittedGame.descriptionShort,
      steamAppid: newlySubmittedGame.steamAppid,
      tags: newlySubmittedGame.tags,
      // Ensure rawData is handled correctly (it might be null/undefined)
      rawData: newlySubmittedGame.rawData as SteamRawData | null | undefined,
    };

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
