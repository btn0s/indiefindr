"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { libraryTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function addToLibrary(gameId: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if the game is already in the user's library
    const existingEntry = await db
      .select()
      .from(libraryTable)
      .where(
        and(
          eq(libraryTable.userId, user.id),
          eq(libraryTable.gameRefId, gameId)
        )
      )
      .limit(1);

    if (existingEntry.length === 0) {
      // Add the game to the user's library
      await db.insert(libraryTable).values({
        userId: user.id,
        gameRefId: gameId,
        addedAt: new Date(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding game to library:", error);
    return { success: false, error: "Failed to add game to library" };
  }
}

export async function removeFromLibrary(gameId: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Remove the game from the user's library
    await db
      .delete(libraryTable)
      .where(
        and(
          eq(libraryTable.userId, user.id),
          eq(libraryTable.gameRefId, gameId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error("Error removing game from library:", error);
    return { success: false, error: "Failed to remove game from library" };
  }
}

export async function getLibraryGameIds() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated", data: [] };
    }

    // Get all game IDs in the user's library
    const libraryEntries = await db
      .select({ gameId: libraryTable.gameRefId })
      .from(libraryTable)
      .where(eq(libraryTable.userId, user.id));

    const gameIds = libraryEntries.map((entry) => entry.gameId);

    return { success: true, data: gameIds };
  } catch (error) {
    console.error("Error getting library game IDs:", error);
    return { success: false, error: "Failed to get library game IDs", data: [] };
  }
}

