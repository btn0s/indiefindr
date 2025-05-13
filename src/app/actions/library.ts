"use server";

import { createActionClient } from "@/utils/supabase/actions";
import { db, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

// Define a simple return type for actions (can be expanded)
type ActionResult = { success: boolean; message?: string };

/**
 * Server Action to add a game to the current user's library.
 *
 * @param gameRefId The ID of the game from the external_source table.
 * @returns An object indicating success or failure.
 */
export async function addToLibrary(gameRefId: number): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in addToLibrary:", authError);
    return { success: false, message: "Authentication required." };
  }

  console.log(
    `User ${user.id} attempting to add game ${gameRefId} to library.`
  );

  const gameExists = await db.query.externalSourceTable.findFirst({
    where: eq(schema.externalSourceTable.id, gameRefId),
    columns: { id: true },
  });
  if (!gameExists) {
    return { success: false, message: "Game not found." };
  }

  const userIdToInsert = user.id;
  console.log(
    "Attempting to insert into library with userId:",
    userIdToInsert,
    "and gameRefId:",
    gameRefId
  );

  // Insert, ignoring conflicts (if already in library)
  await db
    .insert(schema.libraryTable)
    .values({ userId: userIdToInsert, gameRefId })
    .onConflictDoNothing()
    .execute();

  // Revalidate paths to update UI
  // revalidatePath("/"); // Removed to allow optimistic UI
  revalidatePath("/profile"); // Keep profile revalidation if needed

  return { success: true, message: "Game added to library." };
}

/**
 * Server Action to remove a game from the current user's library.
 *
 * @param gameRefId The ID of the game from the external_source table.
 * @returns An object indicating success or failure.
 */
export async function removeFromLibrary(
  gameRefId: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error in removeFromLibrary:", authError);
    return { success: false, message: "Authentication required." };
  }

  console.log(
    `User ${user.id} attempting to remove game ${gameRefId} from library.`
  );

  // Delete the specific entry
  await db
    .delete(schema.libraryTable)
    .where(
      and(
        eq(schema.libraryTable.userId, user.id),
        eq(schema.libraryTable.gameRefId, gameRefId)
      )
    )
    .execute(); // Assume success if no error thrown

  // Revalidate paths
  // revalidatePath("/"); // Removed to allow optimistic UI
  revalidatePath("/profile"); // Keep profile revalidation if needed

  return { success: true, message: "Game removed from library." };
}

/**
 * Server Action to get the current user's library game IDs.
 */
export async function getLibraryGameIds(): Promise<{
  success: boolean;
  data?: number[];
  error?: string;
}> {
  const supabase = createActionClient();
  try {
    const {
      data: { user },
      error: authError,
    } = await (await supabase).auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const libraryItems = await db.query.libraryTable.findMany({
      where: eq(schema.libraryTable.userId, user.id),
      columns: { gameRefId: true },
    });
    return { success: true, data: libraryItems.map((item) => item.gameRefId) };
  } catch (error: any) {
    console.error("[Action getLibraryGameIds] Error:", error);
    return { success: false, error: "Failed to fetch library IDs." };
  }
}
