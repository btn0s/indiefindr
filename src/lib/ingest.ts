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
      shortDesc: steamData.short_description,
      longDesc: steamData.long_description,
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
    shortDesc: gameData.short_description,
    longDesc: gameData.long_description,
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

function buildSuggestionContext(input: {
  title: string | null;
  shortDesc: string | null;
  longDesc: string | null;
  raw?: unknown;
}): string {
  const title = (input.title || "").trim();
  const shortDesc = cleanSteamText(input.shortDesc);
  const longDesc = cleanSteamText(input.longDesc);

  const steamHints = extractSteamHints(input.raw);
  const keywords = extractKeywords([shortDesc, longDesc].filter(Boolean).join(" "), title);
  const queryIdeas = buildQueryIdeas({
    title,
    genres: steamHints.genres,
    categories: steamHints.categories,
    developers: steamHints.developers,
    keywords,
  });

  const lines: string[] = [];

  lines.push("Steam page hints (use this to build smarter searches):");
  if (title) lines.push(`- Title: ${title}`);
  if (steamHints.releaseDate) {
    lines.push(
      `- Release: ${steamHints.releaseDate}${steamHints.comingSoon ? " (coming soon)" : ""}`
    );
  }
  if (steamHints.genres.length) lines.push(`- Genres: ${steamHints.genres.join(", ")}`);
  if (steamHints.categories.length) {
    lines.push(`- Store categories/features: ${steamHints.categories.join(", ")}`);
  }
  if (steamHints.developers.length) lines.push(`- Developer: ${steamHints.developers.join(", ")}`);
  if (steamHints.publishers.length) lines.push(`- Publisher: ${steamHints.publishers.join(", ")}`);
  if (keywords.length) lines.push(`- Keywords: ${keywords.slice(0, 14).join(", ")}`);

  if (shortDesc) lines.push(`\nShort description:\n${truncate(shortDesc, 450)}`);
  if (longDesc) lines.push(`\nLong description (excerpt):\n${truncate(longDesc, 1100)}`);

  if (queryIdeas.length) {
    lines.push("\nSuggested search queries (use these as starting points):");
    for (const [i, q] of queryIdeas.entries()) {
      lines.push(`${i + 1}) ${q}`);
    }
  }

  return truncate(lines.join("\n"), 3200);
}

function cleanSteamText(input: string | null): string {
  if (!input) return "";
  const withoutHtml = stripHtml(input);
  const decoded = decodeBasicHtmlEntities(withoutHtml);
  return decoded.replace(/\s+/g, " ").trim();
}

function stripHtml(html: string): string {
  return (
    html
      // Convert common line breaks to newlines first.
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n")
      // Then strip remaining tags.
      .replace(/<[^>]*>/g, " ")
  );
}

function decodeBasicHtmlEntities(text: string): string {
  // Minimal decoding to keep prompts readable without adding dependencies.
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function extractSteamHints(raw: unknown): {
  genres: string[];
  categories: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
  comingSoon: boolean;
} {
  const r = (raw || {}) as Record<string, unknown>;

  const genres = uniqueStrings(
    (Array.isArray(r.genres) ? (r.genres as unknown[]) : [])
      .map((g) => (g as { description?: unknown })?.description)
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
  );

  const categories = uniqueStrings(
    (Array.isArray(r.categories) ? (r.categories as unknown[]) : [])
      .map((c) => (c as { description?: unknown })?.description)
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
  );

  const developers = uniqueStrings(
    (Array.isArray(r.developers) ? (r.developers as unknown[]) : []).filter(
      (d): d is string => typeof d === "string" && d.trim().length > 0
    )
  );

  const publishers = uniqueStrings(
    (Array.isArray(r.publishers) ? (r.publishers as unknown[]) : []).filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0
    )
  );

  const release = (r.release_date || {}) as Record<string, unknown>;
  const releaseDate = typeof release.date === "string" ? release.date : null;
  const comingSoon = Boolean(release.coming_soon);

  return { genres, categories, developers, publishers, releaseDate, comingSoon };
}

function uniqueStrings(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const norm = item.trim();
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

function extractKeywords(text: string, title: string): string[] {
  if (!text) return [];

  const stopwords = new Set(
    [
      "the",
      "and",
      "with",
      "from",
      "into",
      "your",
      "you",
      "our",
      "their",
      "them",
      "this",
      "that",
      "these",
      "those",
      "are",
      "is",
      "was",
      "were",
      "be",
      "been",
      "being",
      "as",
      "at",
      "by",
      "for",
      "in",
      "of",
      "on",
      "to",
      "or",
      "an",
      "a",
      "it",
      "its",
      "game",
      "games",
      "player",
      "players",
      "play",
      "playing",
      "experience",
      "features",
      "feature",
      "includes",
      "include",
      "new",
      "all",
      "one",
      "two",
      "also",
      "can",
      "will",
      "may",
      "more",
      "most",
      "over",
      "under",
      "up",
      "down",
      "out",
      "about",
      "across",
      "through",
      "each",
      "every",
      "where",
      "when",
      "while",
      "what",
      "who",
      "why",
      "how",
    ].map((s) => s.toLowerCase())
  );

  const titleWords = new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );

  const counts = new Map<string, number>();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const t of tokens) {
    if (t.length < 4) continue;
    if (stopwords.has(t)) continue;
    if (titleWords.has(t)) continue;
    // Keep a few useful hyphenated terms (e.g., "souls-like", "deckbuilder").
    const normalized = t.replace(/^-+|-+$/g, "");
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([word]) => word);
}

function buildQueryIdeas(input: {
  title: string;
  genres: string[];
  categories: string[];
  developers: string[];
  keywords: string[];
}): string[] {
  const title = input.title.trim();
  if (!title) return [];

  const genre1 = input.genres[0] || "";
  const kw = input.keywords.slice(0, 6);

  const hasCoop = input.categories.some((c) => /co-?op|cooperative/i.test(c));
  const hasPvP = input.categories.some((c) => /pvp|multiplayer/i.test(c));

  const q: string[] = [];

  q.push(`indie games like "${title}" on Steam`);
  if (genre1) q.push(`indie ${genre1.toLowerCase()} games like "${title}"`);

  if (kw.length >= 2) {
    q.push(`indie ${genre1 ? `${genre1.toLowerCase()} ` : ""}games with ${kw[0]} and ${kw[1]} (Steam)`);
  } else if (kw.length === 1) {
    q.push(`indie ${genre1 ? `${genre1.toLowerCase()} ` : ""}games with ${kw[0]} (Steam)`);
  }

  if (kw.length >= 4) {
    q.push(`games similar to "${title}" ${kw.slice(0, 4).join(" ")} indie`);
  }

  if (hasCoop && genre1) q.push(`co-op indie ${genre1.toLowerCase()} games like "${title}"`);
  if (hasPvP && genre1) q.push(`multiplayer indie ${genre1.toLowerCase()} games like "${title}"`);

  if (input.developers.length) {
    q.push(`${input.developers[0]} games similar to "${title}"`);
  }

  // Deduplicate and cap.
  return uniqueStrings(q).slice(0, 6);
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
