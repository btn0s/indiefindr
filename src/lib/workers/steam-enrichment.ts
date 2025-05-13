import { db, schema } from "@/db"; // Assuming '@' alias for src/ in tsconfig
import { eq, sql } from "drizzle-orm";

// Interface matching the expected structure from Steam's appdetails API
// Based on common structure, might need adjustments
interface SteamAppDetailsData {
  type: string;
  name: string;
  steam_appid: number;
  required_age: number | string;
  is_free: boolean;
  controller_support?: string;
  dlc?: number[];
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  supported_languages: string;
  header_image: string;
  capsule_image: string;
  capsule_imagev5: string;
  website?: string | null;
  pc_requirements: any; // Can be object or array, often complex
  mac_requirements: any;
  linux_requirements: any;
  legal_notice?: string;
  drm_notice?: string;
  ext_user_account_notice?: string;
  developers?: string[];
  publishers?: string[];
  demos?: { appid: number; description: string }[];
  price_overview?: any; // Complex object
  packages?: number[];
  package_groups?: any[];
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  metacritic?: { score: number; url: string };
  categories?: { id: number; description: string }[];
  genres?: { id: string; description: string }[];
  screenshots?: any[];
  movies?: any[];
  recommendations?: { total: number };
  achievements?: any;
  release_date: { coming_soon: boolean; date: string };
  support_info: { url: string; email: string };
  background: string;
  background_raw: string;
  content_descriptors: any;
}

interface SteamApiResponse {
  [appId: string]: {
    success: boolean;
    data?: SteamAppDetailsData;
  };
}

// Type for the data we want to insert/update in our DB
type ExternalSourceInsert = typeof schema.externalSourceTable.$inferInsert;

/**
 * Fetches game details from the Steam API for a given AppID and
 * inserts or updates the data in the external_source table.
 *
 * @param appId The Steam AppID (string) to enrich.
 * @param foundBy Optional UUID of the user who found/submitted the game.
 * @returns Promise resolving when the operation is complete or throws on error.
 */
export async function enrichSteamAppId(
  appId: string,
  foundBy?: string
): Promise<void> {
  console.log(
    `[Enrichment] Starting enrichment for AppID: ${appId}${foundBy ? ` (Found by: ${foundBy})` : ""}`
  );
  const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;

  let apiResponse: SteamApiResponse;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      // Handle non-2xx responses (e.g., 404, 500)
      throw new Error(
        `Steam API request failed with status ${response.status}`
      );
    }
    apiResponse = (await response.json()) as SteamApiResponse;

    if (!apiResponse[appId] || !apiResponse[appId].success) {
      throw new Error(
        `Steam API reported failure for AppID ${appId}. Data: ${JSON.stringify(apiResponse[appId])}`
      );
    }

    const steamData = apiResponse[appId].data;
    if (!steamData) {
      throw new Error(
        `Steam API successful but returned no data for AppID ${appId}`
      );
    }

    // --- Data Extraction ---
    // Extract needed fields according to our schema
    const gameData: Omit<
      ExternalSourceInsert,
      "id" | "embedding" | "createdAt" | "lastFetched"
    > = {
      platform: "steam",
      externalId: appId,
      steamAppid: appId,
      title: steamData.name || null,
      developer: steamData.developers?.[0] || null, // Take the first developer for simplicity
      descriptionShort: steamData.short_description || null,
      descriptionDetailed:
        steamData.detailed_description || steamData.about_the_game || null,
      genres: steamData.genres?.map((g) => g.description) || [],
      // Using categories as a proxy for tags, filter as needed
      tags: steamData.categories?.map((c) => c.description) || [],
      rawData: steamData, // Store the full response for potential future use
      enrichmentStatus: "basic_info_extracted", // Mark as enriched
      isFeatured: false, // Default value
      foundBy: foundBy || null, // Add foundBy field
    };

    console.log(
      `[Enrichment] Fetched data for ${gameData.title} (AppID: ${appId})`
    );

    // --- Database Operation (Upsert) ---
    await db
      .insert(schema.externalSourceTable)
      .values(gameData)
      .onConflictDoUpdate({
        target: schema.externalSourceTable.externalId, // Conflict on unique externalId
        set: {
          ...gameData, // Update all fetched fields
          lastFetched: new Date(), // Update last fetched time
          enrichmentStatus: "basic_info_extracted", // Ensure status is updated even if record exists
          // Don't update foundBy if it already exists
          foundBy: foundBy
            ? sql`COALESCE(${schema.externalSourceTable.foundBy}, ${foundBy})`
            : undefined,
          // Avoid updating embedding here; that's the next step
        },
      })
      .execute(); // Drizzle requires execute() for the final command

    console.log(`[Enrichment] Successfully upserted data for AppID: ${appId}`);
  } catch (error: any) {
    console.error(`[Enrichment] Failed for AppID ${appId}:`, error);
    // Optionally update DB status to 'enrichment_failed' or similar
    try {
      await db
        .update(schema.externalSourceTable)
        .set({ enrichmentStatus: "enrichment_failed", lastFetched: new Date() })
        .where(eq(schema.externalSourceTable.externalId, appId))
        .execute();
    } catch (dbError) {
      console.error(
        `[Enrichment] Failed to update status to failed for AppID ${appId}:`,
        dbError
      );
    }
    // Re-throw the original error to signal failure to the caller
    throw error;
  }
}

// Example usage placeholder
// async function main() {
//   const testAppId = '440'; // Team Fortress 2
//   try {
//     await enrichSteamAppId(testAppId);
//     console.log(`Enrichment process completed for ${testAppId}.`);
//   } catch (error) {
//     console.error(`Enrichment process failed for ${testAppId}.`);
//   }
// }
// main();
