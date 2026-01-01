import { fetchSteamGame, searchAppIdByTitle, type SteamGameData } from "./steam";
import { suggestGames, type SuggestGamesResult } from "./suggest";
import { supabase } from "./supabase/server";
import { Suggestion } from "./supabase/types";

// Track games currently being ingested to prevent duplicate concurrent ingestion
const ingestingGames = new Set<number>();

export type IngestResult = {
  steamData: SteamGameData;
  suggestions: SuggestGamesResult;
};

// ============================================================================
// CORE: Ingest a game (Steam data + optional suggestions)
// ============================================================================

/**
 * Ingest a game by fetching Steam data and optionally generating suggestions.
 *
 * @param steamUrl - Steam store URL or app ID
 * @param skipSuggestions - If true, only fetch Steam data (no Perplexity call)
 * @returns Promise resolving to Steam data and suggestions (suggestions may be empty if generated in background)
 */
export async function ingest(
  steamUrl: string,
  skipSuggestions = false
): Promise<IngestResult> {
  const appId = parseAppId(steamUrl);

  // Return existing data if already in database
  if (appId) {
    const existing = await getExistingGame(appId);
    if (existing) return existing;

    // Wait if already being ingested
    if (ingestingGames.has(appId)) {
      const result = await waitForIngestion(appId);
      if (result) return result;
    }

    ingestingGames.add(appId);
  }

  try {
    // Step 1: Fetch and save Steam data
    console.log("[INGEST] Fetching Steam data for:", steamUrl);
    const steamData = await fetchSteamGame(steamUrl);

    console.log("[INGEST] Saving to database:", steamData.appid);
    await saveSteamData(steamData);

    // Step 2: Generate suggestions in background (if not skipped)
    if (!skipSuggestions && steamData.screenshots?.length) {
      // Run suggestions generation in background - don't await
      generateSuggestionsInBackground(steamData).catch((err) => {
        console.error("[INGEST] Background suggestions error:", err);
      });
    }

    // Return immediately with Steam data (suggestions will be generated in background)
    return { steamData, suggestions: { suggestions: [] } };
  } finally {
    if (appId) ingestingGames.delete(appId);
  }
}

/**
 * Generate suggestions for a game in the background.
 * This is called after steam data is saved so the user can navigate immediately.
 */
async function generateSuggestionsInBackground(steamData: SteamGameData): Promise<void> {
  console.log("[INGEST] Generating suggestions in background for:", steamData.title);
  
  try {
    const textContext = buildTextContext(
      steamData.title,
      steamData.short_description,
      steamData.long_description
    );
    const suggestions = await suggestGames(steamData.screenshots[0], textContext);

    console.log("[INGEST] Saving suggestions for:", steamData.appid);
    await saveSuggestions(steamData.appid, suggestions.suggestions);

    console.log("[INGEST] Background suggestions complete for:", steamData.appid);
  } catch (err) {
    console.error("[INGEST] Failed to generate suggestions for:", steamData.appid, err);
  }
}

// ============================================================================
// CORE: Clear suggestions for a game (dev-only force regeneration)
// ============================================================================

/**
 * Clear all suggestions for a game. Used for force-regenerating suggestions.
 *
 * @param appId - The game's Steam app ID
 */
export async function clearSuggestions(appId: number): Promise<void> {
  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: null,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appId);

  if (error) {
    throw new Error(`Failed to clear suggestions: ${error.message}`);
  }
}

// ============================================================================
// CORE: Refresh suggestions for an existing game
// ============================================================================

/**
 * Generate new suggestions for an existing game and merge with existing ones.
 * Also auto-ingests missing suggested games.
 *
 * @param appId - The game's Steam app ID
 * @returns Promise resolving to merged suggestions
 */
export async function refreshSuggestions(appId: number): Promise<{
  suggestions: Suggestion[];
  newCount: number;
  missingAppIds: number[];
  missingCount: number;
}> {
  // Fetch game data
  const { data: gameData, error } = await supabase
    .from("games_new")
    .select("screenshots, title, short_description, long_description, suggested_game_appids")
    .eq("appid", appId)
    .single();

  if (error || !gameData) {
    throw new Error("Game not found");
  }

  if (!gameData.screenshots?.length) {
    throw new Error("No screenshots available");
  }

  // Generate new suggestions
  console.log("[REFRESH] Generating suggestions for:", gameData.title);
  const textContext = buildTextContext(
    gameData.title,
    gameData.short_description,
    gameData.long_description
  );
  const result = await suggestGames(gameData.screenshots[0], textContext);

  // Merge with existing (deduplicate by appId, prefer new explanations)
  const existingSuggestions: Suggestion[] = gameData.suggested_game_appids || [];
  const merged = mergeSuggestions(existingSuggestions, result.suggestions);

  // Save merged suggestions
  await saveSuggestions(appId, merged);

  // Surface missing app IDs so the UI can hydrate incrementally (avoids large cascades).
  const missingAppIds = await findMissingGameIds(merged.map((s) => s.appId));

  return {
    suggestions: merged,
    newCount: result.suggestions.length,
    missingAppIds,
    missingCount: missingAppIds.length,
  };
}

// ============================================================================
// SHARED: Auto-ingest missing games
// ============================================================================

/**
 * Find which app IDs don't exist in the database.
 */
export async function findMissingGameIds(appIds: number[]): Promise<number[]> {
  if (!appIds.length) return [];

  const { data: existing } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appIds);

  const existingSet = new Set((existing || []).map((g) => g.appid));
  return appIds.filter((id) => !existingSet.has(id));
}

// Track games currently being auto-ingested to prevent duplicate concurrent attempts
const autoIngestingGames = new Set<number>();

/**
 * Auto-ingest games that don't exist in the database.
 * Fetches Steam data only (no suggestions) to avoid cascade.
 * Runs sequentially to respect rate limits.
 * When ingestion fails with "not found", tries to correct the suggestion using title search.
 */
export async function autoIngestMissingGames(appIds: number[]): Promise<void> {
  const missingIds = await findMissingGameIds(appIds);
  if (!missingIds.length) return;

  // Filter out games already being ingested
  const toIngest = missingIds.filter((id) => !autoIngestingGames.has(id));
  if (!toIngest.length) return;

  // Mark as ingesting
  toIngest.forEach((id) => autoIngestingGames.add(id));

  console.log(`[AUTO-INGEST] Ingesting ${toIngest.length} missing games...`);

  for (const appId of toIngest) {
    try {
      await ingest(`https://store.steampowered.com/app/${appId}/`, true);
      console.log(`[AUTO-INGEST] Success: ${appId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AUTO-INGEST] Failed: ${appId}`, message);

      // If game doesn't exist on Steam, try to correct using title search
      if (message.includes("not found") || message.includes("unavailable")) {
        await correctOrRemoveInvalidSuggestion(appId);
      }
    } finally {
      autoIngestingGames.delete(appId);
    }
  }

  console.log(`[AUTO-INGEST] Completed ${toIngest.length} games`);
}

/**
 * Try to correct an invalid suggestion using title search.
 * If correction succeeds, updates the suggestion with the correct app ID.
 * If correction fails, removes the suggestion entirely.
 */
async function correctOrRemoveInvalidSuggestion(invalidAppId: number): Promise<void> {
  try {
    // Find all games that have this invalid suggestion
    const { data: gamesWithSuggestion } = await supabase
      .from("games_new")
      .select("appid, suggested_game_appids")
      .not("suggested_game_appids", "is", null);

    if (!gamesWithSuggestion) return;

    for (const game of gamesWithSuggestion) {
      const suggestions: Suggestion[] = game.suggested_game_appids || [];
      const invalidSuggestion = suggestions.find((s) => s.appId === invalidAppId);

      if (!invalidSuggestion) continue;

      // Try to find the correct app ID using the title
      let correctedId: number | null = null;
      if (invalidSuggestion.title) {
        console.log(`[AUTO-INGEST] Searching for "${invalidSuggestion.title}" to correct ${invalidAppId}`);
        correctedId = await searchAppIdByTitle(invalidSuggestion.title);
      }

      if (correctedId && correctedId !== invalidAppId) {
        // Correction succeeded - update the suggestion
        console.log(`[AUTO-INGEST] Corrected ${invalidAppId} → ${correctedId} for game ${game.appid}`);
        const corrected = suggestions.map((s) =>
          s.appId === invalidAppId ? { ...s, appId: correctedId! } : s
        );
        await supabase
          .from("games_new")
          .update({ suggested_game_appids: corrected, updated_at: new Date().toISOString() })
          .eq("appid", game.appid);

        // Try to ingest the corrected game
        try {
          await ingest(`https://store.steampowered.com/app/${correctedId}/`, true);
          console.log(`[AUTO-INGEST] Ingested corrected game ${correctedId}`);
        } catch {
          console.log(`[AUTO-INGEST] Failed to ingest corrected game ${correctedId}`);
        }
      } else {
        // Correction failed - remove the suggestion
        console.log(`[AUTO-INGEST] No correction found, removing ${invalidAppId} from game ${game.appid}`);
        const filtered = suggestions.filter((s) => s.appId !== invalidAppId);
        await supabase
          .from("games_new")
          .update({ suggested_game_appids: filtered, updated_at: new Date().toISOString() })
          .eq("appid", game.appid);
      }
    }
  } catch (err) {
    console.error(`[AUTO-INGEST] Failed to correct/remove suggestion ${invalidAppId}:`, err);
  }
}

// ============================================================================
// HELPERS: Database operations
// ============================================================================

async function saveSteamData(steamData: SteamGameData): Promise<void> {
  const { error } = await supabase.from("games_new").upsert(
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
    { onConflict: "appid" }
  );

  if (error) {
    throw new Error(`Failed to save Steam data: ${error.message}`);
  }
}

async function saveSuggestions(appId: number, suggestions: Suggestion[]): Promise<void> {
  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: suggestions,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appId);

  if (error) {
    throw new Error(`Failed to save suggestions: ${error.message}`);
  }
}

// ============================================================================
// HELPERS: Utilities
// ============================================================================

function parseAppId(steamUrl: string): number | null {
  const match = steamUrl.match(/\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : null;
}

function buildTextContext(
  title: string | null,
  shortDesc: string | null,
  longDesc: string | null
): string {
  return [title, shortDesc, longDesc].filter(Boolean).join(". ");
}

function mergeSuggestions(existing: Suggestion[], incoming: Suggestion[]): Suggestion[] {
  const map = new Map<number, Suggestion>();
  for (const s of existing) map.set(s.appId, s);
  for (const s of incoming) map.set(s.appId, s); // Incoming overwrites
  return Array.from(map.values());
}

async function getExistingGame(appId: number): Promise<IngestResult | null> {
  const { data: existing } = await supabase
    .from("games_new")
    .select("*")
    .eq("appid", appId)
    .maybeSingle();

  if (!existing) return null;

  console.log(`[INGEST] Game ${appId} already exists, returning cached data`);
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
      suggestions: existing.suggested_game_appids || [],
    },
  };
}

async function waitForIngestion(appId: number): Promise<IngestResult | null> {
  console.log(`[INGEST] Game ${appId} is being ingested, waiting...`);

  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await getExistingGame(appId);
    if (result) return result;
  }

  return null; // Proceed with ingestion if timeout
}
