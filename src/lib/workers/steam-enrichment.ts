import { db, schema } from "@/lib/db"; // Assuming '@' alias for src/ in tsconfig
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
type GameInsert = typeof schema.gamesTable.$inferInsert;

/**
 * Fetches game details from the Steam API for a given AppID and
 * inserts or updates the data in the gamesTable, then populates
 * gameEnrichmentTable with specific details from Steam.
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
    `[Enrichment] Starting Steam processing for AppID: ${appId}${foundBy ? ` (Found by: ${foundBy})` : ""}`
  );
  const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;

  let apiResponse: SteamApiResponse;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
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

    // --- Data Extraction for gamesTable ---
    const gameDataForTable: Omit<
      GameInsert, // Updated type
      "id" | "embedding" | "createdAt" | "lastFetched" // id is serial, others have defaults or set later
    > = {
      platform: "steam",
      externalId: appId,
      steamAppid: appId,
      title: steamData.name || undefined, // Use undefined for optional fields if null/empty
      developer: steamData.developers?.[0] || undefined,
      descriptionShort: steamData.short_description || undefined,
      descriptionDetailed:
        steamData.detailed_description || steamData.about_the_game || undefined,
      genres: steamData.genres?.map((g) => g.description) || [],
      tags: steamData.categories?.map((c) => c.description) || [], // Using categories as proxy for tags
      rawData: steamData,
      enrichmentStatus: "pending", // Default, will be updated below
      isFeatured: false,
      foundBy: foundBy || undefined,
    };

    console.log(
      `[Enrichment] Fetched core data for ${gameDataForTable.title} (AppID: ${appId})`
    );

    // --- Database Operation (Upsert into gamesTable) ---
    const upsertResult = await db
      .insert(schema.gamesTable) // Updated to gamesTable
      .values({
        ...gameDataForTable,
        enrichmentStatus: "partial", // Example status from gameOverallEnrichmentStatusEnum
      })
      .onConflictDoUpdate({
        target: schema.gamesTable.externalId, // Updated target
        set: {
          ...gameDataForTable,
          lastFetched: new Date(),
          enrichmentStatus: "partial", // Ensure status is updated
          foundBy: foundBy
            ? sql`COALESCE(${schema.gamesTable.foundBy}, ${foundBy})` // Updated table ref
            : undefined,
        },
      })
      .returning({ insertedId: schema.gamesTable.id }) // Get the ID
      .execute();

    const gameIdFromDb = upsertResult[0]?.insertedId;

    if (!gameIdFromDb) {
      throw new Error(
        `Failed to get ID from gamesTable upsert for AppID: ${appId}`
      );
    }

    console.log(
      `[Enrichment] Successfully upserted data to gamesTable for AppID: ${appId}, Game ID: ${gameIdFromDb}`
    );

    // --- Populate gameEnrichmentTable ---
    const enrichmentEntries: (typeof schema.gameEnrichmentTable.$inferInsert)[] =
      [];

    // Detailed Description
    if (steamData.detailed_description || steamData.about_the_game) {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "description",
        contentValue:
          steamData.detailed_description || steamData.about_the_game,
        status: "active",
      });
    }

    // Website
    if (steamData.website) {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "article_url", // Consider a "official_website" type
        contentValue: steamData.website,
        status: "active",
      });
    }

    // Metacritic
    if (steamData.metacritic) {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam", // Data is from Steam API, even if source is Metacritic
        contentType: "review_snippet", // Consider "metacritic_score"
        contentJson: {
          score: steamData.metacritic.score,
          url: steamData.metacritic.url,
        },
        status: "active",
      });
    }

    // Header Image
    if (steamData.header_image) {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "image_url",
        contentValue: steamData.header_image,
        contentJson: { type: "header" },
        status: "active",
      });
    }

    // Screenshots
    steamData.screenshots?.forEach((ss) => {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "image_url",
        contentValue: ss.path_full, // Or path_thumbnail
        contentJson: { id: ss.id, type: "screenshot" },
        status: "active",
      });
    });

    // Movies/Trailers
    steamData.movies?.forEach((movie) => {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "video_url",
        contentValue:
          movie.mp4?.max ||
          movie.mp4?.["480"] ||
          movie.webm?.max ||
          movie.webm?.["480"],
        contentJson: {
          id: movie.id,
          name: movie.name,
          thumbnail: movie.thumbnail,
          type: movie.highlight ? "highlight_trailer" : "trailer",
        },
        status: "active",
      });
    });

    // PC Requirements
    if (
      steamData.pc_requirements &&
      (steamData.pc_requirements.minimum ||
        steamData.pc_requirements.recommended)
    ) {
      enrichmentEntries.push({
        gameId: gameIdFromDb,
        sourceName: "steam",
        contentType: "system_requirements",
        contentJson: { platform: "pc", ...steamData.pc_requirements },
        status: "active",
      });
    }
    // (Could add Mac/Linux requirements similarly)

    if (enrichmentEntries.length > 0) {
      try {
        await db
          .insert(schema.gameEnrichmentTable)
          .values(enrichmentEntries)
          .execute();
        console.log(
          `[Enrichment] Successfully inserted ${enrichmentEntries.length} enrichment entries for Game ID: ${gameIdFromDb}`
        );
        // Update gamesTable status to 'enriched' or similar if all went well
        await db
          .update(schema.gamesTable)
          .set({ enrichmentStatus: "enriched" }) // Example final status
          .where(eq(schema.gamesTable.id, gameIdFromDb))
          .execute();
      } catch (enrichError) {
        console.error(
          `[Enrichment] Failed to insert enrichment entries for Game ID: ${gameIdFromDb}:`,
          enrichError
        );
        // Optionally set gamesTable status to something like 'enrichment_partial_failure'
        await db
          .update(schema.gamesTable)
          .set({ enrichmentStatus: "failed" }) // Example status
          .where(eq(schema.gamesTable.id, gameIdFromDb))
          .execute();
      }
    } else {
      // If no specific enrichment entries were generated, but core data was saved.
      await db
        .update(schema.gamesTable)
        .set({ enrichmentStatus: "partial" }) // Or 'steam_core_only' etc.
        .where(eq(schema.gamesTable.id, gameIdFromDb))
        .execute();
      console.log(
        `[Enrichment] No specific enrichment entries to add for Game ID: ${gameIdFromDb}. Core data saved.`
      );
    }

    console.log(`[Enrichment] Steam processing completed for AppID: ${appId}`);
  } catch (error: any) {
    console.error(
      `[Enrichment] Steam processing failed for AppID ${appId}:`,
      error
    );
    // Update gamesTable status to 'failed'
    try {
      await db
        .update(schema.gamesTable) // Updated to gamesTable
        .set({ enrichmentStatus: "failed", lastFetched: new Date() }) // Example status
        .where(eq(schema.gamesTable.externalId, appId)) // Updated table ref
        .execute();
    } catch (dbError) {
      console.error(
        `[Enrichment] Failed to update gamesTable status to failed for AppID ${appId}:`,
        dbError
      );
    }
    throw error; // Re-throw the original error
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
