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
  const { data: existingGames, error: checkError } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appIds);
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:31',message:'Checked existing games',data:{appIdsCount:appIds.length,appIds,existingGamesCount:existingGames?.length||0,existingAppIds:existingGames?.map((g:any)=>g.appid)||[],checkError:checkError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  const existingAppIds = new Set((existingGames || []).map((g) => g.appid));
  const gamesToFetch = appIds.filter((id) => !existingAppIds.has(id));
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:37',message:'Games to fetch determined',data:{gamesToFetchCount:gamesToFetch.length,gamesToFetch},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (gamesToFetch.length === 0) {
    console.log("[SUGGESTED GAMES] All games already exist in database");
    return;
  }

  console.log(`[SUGGESTED GAMES] Fetching ${gamesToFetch.length} games from Steam...`);

  // Fetch and save each game (the queue will handle rate limiting)
  const promises = gamesToFetch.map(async (appId) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:49',message:'Fetching game from Steam',data:{appId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const steamData = await fetchSteamGame(appId.toString());
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:52',message:'Fetched game from Steam, saving to DB',data:{appId,title:steamData.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      await saveSteamDataToDb(steamData);
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:54',message:'Saved game to DB successfully',data:{appId,title:steamData.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.log(`[SUGGESTED GAMES] Saved game ${appId}: ${steamData.title}`);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/055e2add-99d2-4ef2-b7d5-155378144b2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'suggestedGames.ts:57',message:'Failed to fetch/save game',data:{appId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
