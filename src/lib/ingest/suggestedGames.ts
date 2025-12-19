import { fetchSteamGame, type SteamGameData } from "../steam";
import { supabase } from "../supabase/server";
import { parseSteamUrl } from "../steam";
import type { ParsedSuggestionItem } from "../supabase/types";

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
 * Search for a game in the database by title (case-insensitive partial match)
 */
async function findGameByTitle(title: string): Promise<number | null> {
  if (!title) return null;

  const { data } = await supabase
    .from("games_new")
    .select("appid")
    .ilike("title", `%${title}%`)
    .limit(1)
    .maybeSingle();

  return data?.appid || null;
}

/**
 * Fetch and save Steam data for suggested games
 * Uses app ID first, falls back to title search if app ID fetch fails
 */
export async function fetchAndSaveSuggestedGames(
  suggestions: ParsedSuggestionItem[]
): Promise<void> {
  if (suggestions.length === 0) return;

  // Extract app IDs
  const appIds = suggestions
    .map((s) => s.appId)
    .filter((id): id is number => id !== undefined);

  // Check which games already exist in the database
  const { data: existingGames } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appIds);

  const existingAppIds = new Set((existingGames || []).map((g) => g.appid));

  console.log(
    `[SUGGESTED GAMES] Processing ${suggestions.length} suggestions, ${existingAppIds.size} already exist`
  );

  // Fetch and save each game (the queue will handle rate limiting)
  const promises = suggestions.map(async (suggestion) => {
    // Skip if we already have this game
    if (suggestion.appId && existingAppIds.has(suggestion.appId)) {
      return;
    }

    let appIdToFetch = suggestion.appId;

    // If no app ID or app ID fetch failed, try searching by title
    if (!appIdToFetch && suggestion.title) {
      const foundAppId = await findGameByTitle(suggestion.title);
      if (foundAppId) {
        appIdToFetch = foundAppId;
        console.log(
          `[SUGGESTED GAMES] Found game by title "${suggestion.title}": ${foundAppId}`
        );
      }
    }

    if (!appIdToFetch) {
      console.warn(
        `[SUGGESTED GAMES] No valid app ID for suggestion: ${suggestion.title}`
      );
      return;
    }

    try {
      const steamData = await fetchSteamGame(appIdToFetch.toString());
      await saveSteamDataToDb(steamData);
      console.log(
        `[SUGGESTED GAMES] Saved game ${appIdToFetch}: ${steamData.title}`
      );
    } catch (error) {
      // If app ID fetch failed and we have a title, try searching by title
      if (suggestion.title && suggestion.appId === appIdToFetch) {
        const foundAppId = await findGameByTitle(suggestion.title);
        if (foundAppId && foundAppId !== appIdToFetch) {
          try {
            const steamData = await fetchSteamGame(foundAppId.toString());
            await saveSteamDataToDb(steamData);
            console.log(
              `[SUGGESTED GAMES] Fallback: Found and saved "${suggestion.title}" with app ID ${foundAppId}`
            );
            return;
          } catch (fallbackError) {
            // Fallback also failed, log and continue
            console.error(
              `[SUGGESTED GAMES] Fallback fetch also failed for "${suggestion.title}":`,
              fallbackError
            );
          }
        }
      }
      console.error(
        `[SUGGESTED GAMES] Failed to fetch/save game ${appIdToFetch} (${suggestion.title}):`,
        error
      );
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
