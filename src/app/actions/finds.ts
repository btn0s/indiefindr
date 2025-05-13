"use server";

import { db } from "@/db";
import { externalSourceTable, profilesTable } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { SteamRawData } from "@/types/steam";
// import { createClient } from "@/utils/supabase/server"; // Needed for auth check? Maybe not directly, but good practice if needed

// Define the return type structure, matching GameForGrid from the profile page
type FoundGame = {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  foundByUsername: string | null;
  foundByAvatarUrl: string | null; // Add avatar URL
  rawData?: SteamRawData | null;
};

type GetGamesFoundByUserResult = {
  success: boolean;
  data?: FoundGame[];
  error?: string;
};

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
    const foundGamesData = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        descriptionShort: externalSourceTable.descriptionShort,
        steamAppid: externalSourceTable.steamAppid,
        foundByUsername: profilesTable.username,
        foundByAvatarUrl: profilesTable.avatarUrl, // Add avatar URL
        rawData: sql<SteamRawData | null>`${externalSourceTable.rawData}`,
      })
      .from(externalSourceTable)
      .leftJoin(
        profilesTable,
        eq(externalSourceTable.foundBy, profilesTable.id)
      )
      .where(eq(externalSourceTable.foundBy, userId))
      .orderBy(desc(externalSourceTable.createdAt)); // Order by creation date, newest first

    // Ensure the result matches the FoundGame type (it should automatically)
    const foundGames: FoundGame[] = foundGamesData;

    return { success: true, data: foundGames };
  } catch (error: any) {
    console.error(`Error fetching games found by user ${userId}:`, error);
    return {
      success: false,
      error: `Failed to fetch user's finds: ${error.message}`,
    };
  }
}
