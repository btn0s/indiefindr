"use server";

import { createClient } from "@/lib/supabase/server";
import { DefaultLibraryService } from "@/lib/services/library-service";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Schema for input validation
const gameIdSchema = z
  .number()
  .int()
  .positive("Game ID must be a positive integer.");

const libraryService = new DefaultLibraryService(); // Instantiate the service

export async function addToLibrary(gameIdInput: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate gameId
    const validationResult = gameIdSchema.safeParse(gameIdInput);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid Game ID",
        details: validationResult.error.flatten().fieldErrors,
      };
    }
    const gameId = validationResult.data;

    // Call the service layer method
    const result = await libraryService.addGameToUserLibrary(user.id, gameId);

    if (result.success) {
      // Revalidate relevant paths if the operation was successful
      // Example: revalidate the page showing the user's library or the game's page
      revalidatePath("/library"); // Adjust path as needed
      revalidatePath(`/games/${gameId}`); // Adjust path as needed
    }

    return result; // Return the result from the service { success, error?, entry? }
  } catch (error) {
    // Catch unexpected errors in the action itself
    console.error("Error in addToLibrary action:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected server error occurred in the action.",
    };
  }
}

export async function removeFromLibrary(gameIdInput: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate gameId
    const validationResult = gameIdSchema.safeParse(gameIdInput);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid Game ID",
        details: validationResult.error.flatten().fieldErrors,
      };
    }
    const gameId = validationResult.data;

    // Call the service layer method
    const result = await libraryService.removeGameFromUserLibrary(
      user.id,
      gameId
    );

    if (result.success) {
      // Revalidate relevant paths if the operation was successful
      revalidatePath("/library"); // Adjust path as needed
      revalidatePath(`/games/${gameId}`); // Adjust path as needed
    }

    return result; // Return the result from the service { success, error? }
  } catch (error) {
    console.error("Error in removeFromLibrary action:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected server error occurred in the action.",
    };
  }
}

