import { fetchSteamGame, type SteamGameData } from "./steam";
import { suggestGames, type SuggestGamesResult } from "./suggest";
import { supabase } from "./supabase/server";

// Track games currently being ingested to prevent duplicate concurrent ingestion
const ingestingGames = new Set<number>();

export type IngestResult = {
  steamData: SteamGameData;
  suggestions: SuggestGamesResult;
};

/**
 * Ingest a game by fetching Steam data and generating suggestions.
 * Saves Steam data to DB immediately, then saves suggestions to games_new table.
 * Automatically ingests suggested games that don't exist in the database.
 * 
 * @param steamUrl - Steam store URL or app ID
 * @returns Promise resolving to Steam data and game suggestions
 */
export async function ingest(steamUrl: string): Promise<IngestResult> {
  // Parse appid to check if already ingesting or exists
  const appIdMatch = steamUrl.match(/\/(\d+)\/?$/);
  const appId = appIdMatch ? parseInt(appIdMatch[1], 10) : null;
  
  // Check if game already exists in database
  if (appId) {
    const { data: existing } = await supabase
      .from("games_new")
      .select("*")
      .eq("appid", appId)
      .maybeSingle();
    
    if (existing) {
      console.log(`[INGEST] Game ${appId} already exists in database, returning existing data`);
      const rawType = (existing.raw as { type?: string })?.type || "game";
      return {
        steamData: {
          appid: existing.appid,
          title: existing.title,
          screenshots: existing.screenshots || [],
          videos: existing.videos || [],
          header_image: existing.header_image,
          short_description: existing.short_description,
          long_description: existing.long_description,
          type: rawType,
          raw: existing.raw,
        },
        suggestions: {
          validatedAppIds: existing.suggested_game_appids || [],
        },
      };
    }

    // Prevent concurrent duplicate ingestion
    if (ingestingGames.has(appId)) {
      console.log(`[INGEST] Game ${appId} is already being ingested, waiting for completion...`);
      // Wait and retry a few times
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { data: completed } = await supabase
          .from("games_new")
          .select("*")
          .eq("appid", appId)
          .maybeSingle();
        if (completed) {
          const rawType = (completed.raw as { type?: string })?.type || "game";
          return {
            steamData: {
              appid: completed.appid,
              title: completed.title,
              screenshots: completed.screenshots || [],
              videos: completed.videos || [],
              header_image: completed.header_image,
              short_description: completed.short_description,
              long_description: completed.long_description,
              type: rawType,
              raw: completed.raw,
            },
            suggestions: {
              validatedAppIds: completed.suggested_game_appids || [],
            },
          };
        }
      }
      // If still not done after waiting, proceed anyway (might have failed)
    }

    ingestingGames.add(appId);
  }

  try {
    // Step 1: Fetch Steam game data
    console.log("[INGEST] Fetching Steam data for:", steamUrl);
    const steamData = await fetchSteamGame(steamUrl);

    // Step 2: Save Steam data to DB immediately
    console.log("[INGEST] Saving Steam data to database for appid:", steamData.appid);
    await saveSteamDataToDb(steamData);

    // Step 3: Generate suggestions using the first screenshot
    if (!steamData.screenshots || steamData.screenshots.length === 0) {
      throw new Error(`No screenshots available for game ${steamData.appid}`);
    }

    const firstScreenshot = steamData.screenshots[0];
    
    // Build text context from game title and descriptions
    const textContext = [
      steamData.title,
      steamData.short_description,
      steamData.long_description,
    ]
      .filter(Boolean)
      .join(". ");

    console.log("[INGEST] Generating suggestions for:", steamData.title);
    const suggestions = await suggestGames(firstScreenshot, textContext);

    // Step 4: Save suggestions to DB
    console.log("[INGEST] Saving suggestions to database for appid:", steamData.appid);
    await saveSuggestionsToDb(steamData.appid, suggestions);

    // Step 5: Auto-ingest suggested games that don't exist yet (always runs in background)
    // Don't await - run in background to avoid blocking
    autoIngestSuggestedGames(suggestions.validatedAppIds).catch((err) => {
      console.error("[INGEST] Error in auto-ingest suggested games:", err);
    });

    return {
      steamData,
      suggestions,
    };
  } finally {
    // Remove from ingesting set when done
    if (appId) {
      ingestingGames.delete(appId);
    }
  }
}

/**
 * Save Steam game data to the games_new table
 */
async function saveSteamDataToDb(steamData: SteamGameData): Promise<void> {
  const { error } = await supabase
    .from("games_new")
    .upsert(
      {
        appid: steamData.appid,
        screenshots: steamData.screenshots,
        videos: steamData.videos,
        title: steamData.title,
        header_image: steamData.header_image,
        short_description: steamData.short_description,
        long_description: steamData.long_description,
        raw: steamData.raw,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "appid",
      }
    );

  if (error) {
    throw new Error(`Failed to save Steam data to database: ${error.message}`);
  }
}

/**
 * Save suggestions to the games_new table
 */
async function saveSuggestionsToDb(
  appid: number,
  suggestions: SuggestGamesResult
): Promise<void> {
  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: suggestions.validatedAppIds,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appid);

  if (error) {
    throw new Error(`Failed to save suggestions to database: ${error.message}`);
  }
}

/**
 * Auto-ingest suggested games that don't exist in the database yet.
 * This ensures suggestions are always visible in the UI.
 * Runs in background to avoid blocking the main ingestion.
 * 
 * Note: Global rate limiter in steam.ts handles the 2s delay between Steam API requests.
 */
async function autoIngestSuggestedGames(suggestedAppIds: number[]): Promise<void> {
  if (!suggestedAppIds || suggestedAppIds.length === 0) {
    return;
  }

  console.log(`[INGEST] Checking ${suggestedAppIds.length} suggested games for auto-ingestion...`);

  try {
    // Check which suggested games already exist in games_new
    const { data: existingGames } = await supabase
      .from("games_new")
      .select("appid")
      .in("appid", suggestedAppIds);

    const existingAppids = new Set((existingGames || []).map((g) => g.appid));
    const missingAppids = suggestedAppIds.filter((id) => !existingAppids.has(id));

    if (missingAppids.length === 0) {
      console.log("[INGEST] All suggested games already exist in database");
      return;
    }

    console.log(`[INGEST] Found ${missingAppids.length} missing games, queueing for ingestion...`);

    // Ingest missing games sequentially to respect rate limits
    // The global rate limiter in steam.ts handles the 2s delay between Steam API calls
    for (const missingAppid of missingAppids) {
      const steamUrl = `https://store.steampowered.com/app/${missingAppid}/`;
      
      try {
        await ingest(steamUrl);
        console.log(`[INGEST] Successfully auto-ingested game ${missingAppid}`);
      } catch (err) {
        console.error(
          `[INGEST] Failed to auto-ingest suggested game ${missingAppid}:`,
          err instanceof Error ? err.message : String(err)
        );
        // Continue with next game even if one fails
      }
    }

    console.log(`[INGEST] Completed auto-ingestion of ${missingAppids.length} games`);
  } catch (error) {
    // Don't throw - auto-ingestion failures shouldn't break the main ingestion
    console.error("[INGEST] Error in auto-ingest suggested games:", error);
  }
}
