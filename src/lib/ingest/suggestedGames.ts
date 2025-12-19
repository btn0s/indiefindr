import { fetchSteamGame, type SteamGameData } from "../steam";
import { supabase } from "../supabase/server";
import { parseSteamUrl } from "../steam";

/**
 * Extract Steam app IDs from suggestion items (from their Steam links)
 */
export function extractAppIdsFromSuggestions(steamLinks: string[]): number[] {
  const appIds: number[] = [];
  
  for (const link of steamLinks) {
    if (!link) continue;
    const appId = parseSteamUrl(link);
    if (appId && !appIds.includes(appId)) {
      appIds.push(appId);
    }
  }
  
  return appIds;
}

/**
 * Fetch and save Steam data for a list of app IDs
 * Only fetches games that don't already exist in the database
 */
export async function fetchAndSaveSuggestedGames(appIds: number[]): Promise<void> {
  if (appIds.length === 0) return;

  // Check which games already exist in the database
  const { data: existingGames } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appIds);

  const existingAppIds = new Set((existingGames || []).map((g) => g.appid));
  const gamesToFetch = appIds.filter((id) => !existingAppIds.has(id));

  if (gamesToFetch.length === 0) {
    console.log("[SUGGESTED GAMES] All games already exist in database");
    return;
  }

  console.log(`[SUGGESTED GAMES] Fetching ${gamesToFetch.length} games from Steam...`);

  // Fetch and save each game (the queue will handle rate limiting)
  const promises = gamesToFetch.map(async (appId) => {
    try {
      const steamData = await fetchSteamGame(appId.toString());
      await saveSteamDataToDb(steamData);
      console.log(`[SUGGESTED GAMES] Saved game ${appId}: ${steamData.title}`);
    } catch (error) {
      console.error(`[SUGGESTED GAMES] Failed to fetch/save game ${appId}:`, error);
      // Continue with other games even if one fails
    }
  });

  await Promise.all(promises);
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
