import { db } from "@/lib/db";
import { libraryTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// --- Types ---
export type LibraryEntry = typeof libraryTable.$inferSelect;
export type LibraryEntryInsert = typeof libraryTable.$inferInsert;

// --- Repository Interface ---
export interface LibraryRepository {
  find(userId: string, gameId: number): Promise<LibraryEntry | null>;
  add(userId: string, gameId: number): Promise<LibraryEntry | null>;
  remove(userId: string, gameId: number): Promise<{ success: boolean }>;
  // Get all game IDs in a user's library (similar to what was in UserRepository)
  getAllGameIdsByUserId(userId: string): Promise<number[]>;
}

// --- Drizzle Implementation ---
export class DrizzleLibraryRepository implements LibraryRepository {
  async find(userId: string, gameId: number): Promise<LibraryEntry | null> {
    const result = await db
      .select()
      .from(libraryTable)
      .where(
        and(eq(libraryTable.userId, userId), eq(libraryTable.gameRefId, gameId))
      )
      .limit(1);
    return result[0] || null;
  }

  async add(userId: string, gameId: number): Promise<LibraryEntry | null> {
    try {
      const newEntry: LibraryEntryInsert = {
        userId,
        gameRefId: gameId,
        addedAt: new Date(),
      };
      const result = await db.insert(libraryTable).values(newEntry).returning();
      return result[0] || null;
    } catch (error) {
      console.error(
        "DrizzleLibraryRepository: Error adding to library:",
        error
      );
      // Handle potential duplicate entry errors if necessary, though the service layer will check first.
      return null;
    }
  }

  async remove(userId: string, gameId: number): Promise<{ success: boolean }> {
    try {
      const result = await db
        .delete(libraryTable)
        .where(
          and(
            eq(libraryTable.userId, userId),
            eq(libraryTable.gameRefId, gameId)
          )
        )
        .returning({ id: libraryTable.userId }); // Check if a row was affected
      return { success: result.length > 0 };
    } catch (error) {
      console.error(
        "DrizzleLibraryRepository: Error removing from library:",
        error
      );
      return { success: false };
    }
  }

  async getAllGameIdsByUserId(userId: string): Promise<number[]> {
    try {
      const results = await db
        .select({ gameId: libraryTable.gameRefId })
        .from(libraryTable)
        .where(eq(libraryTable.userId, userId));
      return results.map((r) => r.gameId);
    } catch (error) {
      console.error(
        "DrizzleLibraryRepository: Error fetching library game IDs:",
        error
      );
      return [];
    }
  }
}
