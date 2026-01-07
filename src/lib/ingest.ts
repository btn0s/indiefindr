import { fetchSteamGame, searchAppIdByTitle, type SteamGameData } from "./steam";
import { suggestGames, sanitizeExplanation, type SuggestGamesResult } from "./suggest";
import { getSupabaseServerClient } from "./supabase/server";
import { Suggestion } from "./supabase/types";

// Track games currently being ingested to prevent duplicate concurrent ingestion
const ingestingGames = new Set<number>();

export type IngestResult = {
  steamData: SteamGameData;
  suggestions: SuggestGamesResult;
};

/**
 * Ingest a game by fetching Steam data and optionally generating suggestions.
 *
 * @param steamUrl - Steam store URL or app ID
 * @param skipSuggestions - If true, only fetch Steam data (no Perplexity call)
 * @param force - If true, force re-ingestion even if game already exists
 * @returns Promise resolving to Steam data and suggestions (suggestions may be empty if generated in background)
 */
export async function ingest(
  steamUrl: string,
  skipSuggestions = false,
  force = false
): Promise<IngestResult> {
  const appId = parseAppId(steamUrl);

  // Return existing data if already in database (unless forcing)
  if (appId && !force) {
    const existing = await getExistingGame(appId);
    if (existing) return existing;

    // Wait if already being ingested
    if (ingestingGames.has(appId)) {
      const result = await waitForIngestion(appId);
      if (result) return result;
    }

    ingestingGames.add(appId);
  } else if (appId && force) {
    // When forcing, still check if already being ingested
    if (ingestingGames.has(appId)) {
      const result = await waitForIngestion(appId);
      if (result) return result;
    }
    ingestingGames.add(appId);
  }

  try {
    console.log("[INGEST] Fetching Steam data for:", steamUrl);
    const steamData = await fetchSteamGame(steamUrl);

    console.log("[INGEST] Saving to database:", steamData.appid);
    await saveSteamData(steamData);

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
    const textContext = buildSuggestionContext({
      title: steamData.title,
      short_description: steamData.short_description,
      long_description: steamData.long_description,
      raw: steamData.raw,
    });
    const suggestions = await suggestGames(steamData.screenshots[0], textContext);

    console.log("[INGEST] Saving suggestions for:", steamData.appid);
    await saveSuggestions(steamData.appid, suggestions.suggestions);
    // Home view refresh is now handled automatically by database trigger

    console.log("[INGEST] Background suggestions complete for:", steamData.appid);
  } catch (err) {
    console.error("[INGEST] Failed to generate suggestions for:", steamData.appid, err);
  }
}

/**
 * Clear all suggestions for a game. Used for force-regenerating suggestions.
 *
 * @param appId - The game's Steam app ID
 */
export async function clearSuggestions(appId: number): Promise<void> {
  const supabase = getSupabaseServerClient();
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
  const supabase = getSupabaseServerClient();
  // Fetch game data
  const { data: gameData, error } = await supabase
    .from("games_new")
    .select("screenshots, title, short_description, long_description, raw, suggested_game_appids")
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
  const textContext = buildSuggestionContext({
    title: gameData.title,
    short_description: gameData.short_description,
    long_description: gameData.long_description,
    raw: gameData.raw,
  });
  const result = await suggestGames(gameData.screenshots[0], textContext);

  // Merge with existing (deduplicate by appId, prefer new explanations)
  const existingSuggestions: Suggestion[] = gameData.suggested_game_appids || [];
  const merged = mergeSuggestions(existingSuggestions, result.suggestions);

  // Save merged suggestions
  await saveSuggestions(appId, merged);

  const missingAppIds = await findMissingGameIds(merged.map((s) => s.appId));

  return {
    suggestions: merged,
    newCount: result.suggestions.length,
    missingAppIds,
    missingCount: missingAppIds.length,
  };
}

/**
 * Find which app IDs don't exist in the database.
 */
export async function findMissingGameIds(appIds: number[]): Promise<number[]> {
  const supabase = getSupabaseServerClient();
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
  const supabase = getSupabaseServerClient();
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

async function saveSteamData(steamData: SteamGameData): Promise<void> {
  const supabase = getSupabaseServerClient();
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
  const supabase = getSupabaseServerClient();
  
  // Sanitize explanations before saving
  const sanitized = suggestions.map((s) => ({
    ...s,
    explanation: sanitizeExplanation(s.explanation),
  }));
  
  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appId);

  if (error) {
    throw new Error(`Failed to save suggestions: ${error.message}`);
  }
}

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

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

type SuggestionContextInput = {
  title: string | null;
  short_description: string | null;
  long_description: string | null;
  raw: unknown;
};

type SteamSearchMetadata = {
  genres: string[];
  categories: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
};

function extractSteamSearchMetadata(raw: unknown): SteamSearchMetadata {
  if (!raw || typeof raw !== "object") {
    return {
      genres: [],
      categories: [],
      developers: [],
      publishers: [],
      releaseDate: null,
    };
  }

  const data = raw as {
    genres?: Array<{ description?: string }>;
    categories?: Array<{ description?: string }>;
    developers?: string[];
    publishers?: string[];
    release_date?: { date?: string };
  };

  const genres =
    (data.genres || [])
      .map((g) => (g?.description || "").trim())
      .filter(Boolean)
      .slice(0, 8) || [];

  // Steam categories include lots of store/feature flags; keep the gameplay-salient ones.
  const gameplayCategoryAllowlist = new Set([
    "Single-player",
    "Multi-player",
    "Online PvP",
    "PvP",
    "Online Co-op",
    "Co-op",
    "Local Co-op",
    "Shared/Split Screen",
    "Shared/Split Screen Co-op",
    "Shared/Split Screen PvP",
    "MMO",
    "Controller",
    "Full controller support",
    "Partial Controller Support",
    "Turn-Based",
    "Real-Time",
    "Steam Workshop",
    "VR Supported",
  ]);

  const categories =
    (data.categories || [])
      .map((c) => (c?.description || "").trim())
      .filter((c) => c && gameplayCategoryAllowlist.has(c))
      .slice(0, 10) || [];

  const developers = (Array.isArray(data.developers) ? data.developers : [])
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    .map((d) => d.trim())
    .slice(0, 4);

  const publishers = (Array.isArray(data.publishers) ? data.publishers : [])
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .slice(0, 4);

  const releaseDate =
    typeof data.release_date?.date === "string" ? data.release_date.date : null;

  return { genres, categories, developers, publishers, releaseDate };
}

function extractKeywordsFromText(text: string, title: string | null): string[] {
  const stopwords = new Set([
    "a","an","and","are","as","at","be","but","by","can","could","do","does","for","from","has","have","in","into","is","it","its","like","more","new","of","on","or","our","over","play","player","players","set","the","their","this","to","two","up","with","you","your",
    "game","games","steam","pc","experience","features","feature","including","includes","based","across","each","than","than","will","while","where","when","what","who","how",
  ]);

  const titleWords = new Set(
    (title || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !stopwords.has(t) && !titleWords.has(t));

  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 8);
}

function buildSearchQueries(
  title: string,
  meta: SteamSearchMetadata,
  keywords: string[]
): string[] {
  const queries: string[] = [];
  const safeTitle = title.trim();

  if (safeTitle) {
    queries.push(`"${safeTitle}" similar games`);
    queries.push(`games like "${safeTitle}" on Steam`);
    queries.push(`similar indie games to "${safeTitle}"`);
  }

  const primaryGenre = meta.genres[0];
  if (safeTitle && primaryGenre) {
    queries.push(`indie ${primaryGenre} games like "${safeTitle}"`);
  } else if (primaryGenre) {
    queries.push(`best indie ${primaryGenre} games on Steam`);
  }

  if (meta.categories.length) {
    const cat = meta.categories[0];
    if (safeTitle && primaryGenre) {
      queries.push(`${primaryGenre} ${cat} indie games like "${safeTitle}"`);
    } else if (primaryGenre) {
      queries.push(`${primaryGenre} ${cat} indie games on Steam`);
    }
  }

  if (meta.developers.length && safeTitle) {
    queries.push(`games similar to "${safeTitle}" by ${meta.developers[0]}`);
  }

  const kw = keywords.slice(0, 3);
  if (safeTitle && kw.length) {
    queries.push(`"${safeTitle}" ${kw.join(" ")} similar games`);
  } else if (kw.length) {
    queries.push(`indie games ${kw.join(" ")}`);
  }

  if (meta.releaseDate) {
    const yearMatch = meta.releaseDate.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    if (year && primaryGenre) {
      queries.push(`new indie ${primaryGenre} games ${year} Steam`);
    }
  }

  // De-dupe, keep reasonably short
  const seen = new Set<string>();
  const unique = queries
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q) => q.length > 0 && q.length <= 120)
    .filter((q) => (seen.has(q) ? false : (seen.add(q), true)));

  return unique.slice(0, 10);
}

function buildSuggestionContext(input: SuggestionContextInput): string {
  const title = (input.title || "").trim();
  const meta = extractSteamSearchMetadata(input.raw);

  const descParts = [input.short_description, input.long_description]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(stripHtml);

  const desc = truncate(descParts.join(" "), 900);
  const keywords = desc ? extractKeywordsFromText(desc, title) : [];
  const queries = buildSearchQueries(title, meta, keywords);

  const lines: string[] = [];
  if (title) lines.push(`Title: ${title}`);
  if (desc) lines.push(`Description: ${desc}`);
  if (meta.genres.length) lines.push(`Genres: ${meta.genres.join(", ")}`);
  if (meta.categories.length) lines.push(`Steam categories: ${meta.categories.join(", ")}`);
  if (meta.developers.length) lines.push(`Developers: ${meta.developers.join(", ")}`);
  if (meta.publishers.length) lines.push(`Publishers: ${meta.publishers.join(", ")}`);
  if (meta.releaseDate) lines.push(`Release date: ${meta.releaseDate}`);
  if (keywords.length) lines.push(`Keywords: ${keywords.join(", ")}`);
  if (queries.length) {
    lines.push("Search queries to try (use multiple, not just one):");
    for (const q of queries) lines.push(`- ${q}`);
  }

  // Fallback to the older behavior if everything is missing.
  if (!lines.length) {
    return buildTextContext(input.title, input.short_description, input.long_description);
  }

  return lines.join("\n");
}

function mergeSuggestions(existing: Suggestion[], incoming: Suggestion[]): Suggestion[] {
  const map = new Map<number, Suggestion>();
  for (const s of existing) map.set(s.appId, s);
  for (const s of incoming) map.set(s.appId, s); // Incoming overwrites
  return Array.from(map.values());
}

async function getExistingGame(appId: number): Promise<IngestResult | null> {
  const supabase = getSupabaseServerClient();
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
