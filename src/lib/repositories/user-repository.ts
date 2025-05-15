import { db } from "@/db";
import { profilesTable, libraryTable } from "@/db/schema"; // Assuming libraryTable is needed for getLibraryGameIds
import { eq } from "drizzle-orm";

// --- Types ---
export type Profile = typeof profilesTable.$inferSelect;
export type ProfileInsert = typeof profilesTable.$inferInsert;
export type ProfileUpdate = Partial<ProfileInsert>;

// --- Repository Interface ---
export interface UserRepository {
  getById(userId: string): Promise<Profile | null>;
  getByUsername(username: string): Promise<Profile | null>;
  update(userId: string, data: ProfileUpdate): Promise<Profile | null>;
  getLibraryGameIds(userId: string): Promise<number[]>;
  create(data: ProfileInsert): Promise<Profile | null>;
  // create(data: ProfileInsert): Promise<Profile>; // Placeholder for future create
}

// --- Drizzle Implementation ---
export class DrizzleUserRepository implements UserRepository {
  async getById(userId: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    return result[0] || null;
  }

  async getByUsername(username: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.username, username))
      .limit(1);
    return result[0] || null;
  }

  async update(userId: string, data: ProfileUpdate): Promise<Profile | null> {
    // Ensure `updatedAt` is set if your schema has it and doesn't auto-update
    // const updateData = { ...data, updatedAt: new Date() };
    const result = await db
      .update(profilesTable)
      .set(data) // or updateData
      .where(eq(profilesTable.id, userId))
      .returning();
    return result[0] || null;
  }

  async getLibraryGameIds(userId: string): Promise<number[]> {
    const results = await db
      .select({ gameId: libraryTable.gameRefId })
      .from(libraryTable)
      .where(eq(libraryTable.userId, userId));
    return results.map((r) => r.gameId);
  }

  async create(data: ProfileInsert): Promise<Profile | null> {
    try {
      const result = await db.insert(profilesTable).values(data).returning();
      return result[0] || null; // Drizzle returns the inserted row(s)
    } catch (error) {
      console.error("DrizzleUserRepository: Error creating profile:", error);
      // Depending on how you want to handle DB errors, you might throw, or return null/error indicator
      // For now, let's rethrow or handle it more specifically if it's a known constraint violation (e.g. username unique)
      // If it is a unique constraint violation for username, it might be better to catch it specifically.
      // For a generic error, rethrowing or returning null is an option.
      return null; // Or throw error;
    }
  }

  // Example for create, if you add it to the interface
  /*
  async create(data: ProfileInsert): Promise<Profile> {
    const result = await db.insert(profilesTable).values(data).returning();
    if (!result[0]) throw new Error("Profile creation failed");
    return result[0];
  }
  */
}
