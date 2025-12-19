import { fetchSteamGame, type SteamGameData } from "./steam";
import { suggestGames, type SuggestGamesResult } from "./suggest";
import { supabase } from "./supabase/server";

export type IngestResult = {
  steamData: SteamGameData;
  suggestions: SuggestGamesResult;
};

/**
 * Ingest a game by fetching Steam data and generating suggestions.
 * Saves Steam data to DB immediately, then saves suggestions to games_new table.
 * 
 * @param steamUrl - Steam store URL or app ID
 * @returns Promise resolving to Steam data and game suggestions
 */
export async function ingest(steamUrl: string): Promise<IngestResult> {
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

  return {
    steamData,
    suggestions,
  };
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
