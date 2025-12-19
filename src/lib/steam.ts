import { acquireRateLimit } from "./utils/rate-limiter";
import { retry } from "./utils/retry";

export type SteamGameData = {
  appid: number;
  screenshots: string[];
  videos: string[];
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  type: string; // "game", "dlc", "demo", "mod", etc.
  raw: unknown; // Raw Steam API response
};

/**
 * Parse Steam URL to extract AppID
 * Supports formats:
 * - https://store.steampowered.com/app/123456/GameName/
 * - https://steamcommunity.com/app/123456
 * - store.steampowered.com/app/123456
 */
export function parseSteamUrl(url: string): number | null {
  // Normalize URL
  let normalizedUrl = url.trim();

  // Add https:// if missing
  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // Try to extract AppID from various Steam URL patterns
  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/i,
    /steamcommunity\.com\/app\/(\d+)/i,
    /\/app\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1]) {
      const appId = parseInt(match[1], 10);
      if (!isNaN(appId) && appId > 0) {
        return appId;
      }
    }
  }

  // If URL is just a number, treat it as AppID
  const numericMatch = url.trim().match(/^\d+$/);
  if (numericMatch) {
    const appId = parseInt(numericMatch[0], 10);
    if (!isNaN(appId) && appId > 0) {
      return appId;
    }
  }

  return null;
}

const STEAM_API_BASE_URL = "https://store.steampowered.com/api";

/**
 * Custom error class for Steam API rate limiting
 */
class SteamRateLimitError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = "SteamRateLimitError";
    this.status = 429;
  }
}

/**
 * Fetch game data from Steam API with global rate limiting and retry logic.
 * 
 * @param steamUrl - Steam store URL or app ID
 * @returns Promise resolving to game data
 */
async function fetchGameDataWithRateLimit(steamUrl: string): Promise<SteamGameData> {
  const appId = parseSteamUrl(steamUrl);

  if (!appId) {
    throw new Error(`Invalid Steam URL: ${steamUrl}`);
  }

  // Acquire global rate limit slot (waits for 2s since last request)
  await acquireRateLimit("steam_api", 2000);

  const url = `${STEAM_API_BASE_URL}/appdetails?appids=${appId}&l=english`;

  const response = await fetch(url);

  if (response.status === 429) {
    throw new SteamRateLimitError(
      `Steam API rate limited (429) for app ${appId}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Steam store data: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const appData = data[appId.toString()];

  if (!appData || !appData.success) {
    throw new Error(`Steam app ${appId} not found or unavailable`);
  }

  const game = appData.data;

  // Extract screenshots
  const screenshots = (
    (game.screenshots as Array<{
      path_full?: string;
      path_thumbnail?: string;
    }>) || []
  )
    .map((s) => s.path_full || s.path_thumbnail)
    .filter((url): url is string => Boolean(url));

  // Extract video URLs
  const videos: string[] = [];
  if (game.movies && Array.isArray(game.movies) && game.movies.length > 0) {
    type Movie = {
      highlight?: boolean;
      id: number;
      hls_h264?: string;
      dash_h264?: string;
      dash_av1?: string;
      mp4?: { max?: string; "480"?: string };
      webm?: { max?: string; "480"?: string };
    };

    const sortedMovies = [...(game.movies as Movie[])].sort((a, b) => {
      if (a.highlight && !b.highlight) return -1;
      if (!a.highlight && b.highlight) return 1;
      return a.id - b.id;
    });

    for (const movie of sortedMovies) {
      const videoUrl =
        movie.hls_h264 ||
        movie.dash_h264 ||
        movie.dash_av1 ||
        movie.mp4?.max ||
        movie.mp4?.["480"] ||
        movie.webm?.max ||
        movie.webm?.["480"];

      if (videoUrl) {
        videos.push(videoUrl);
      }
    }
  }

  return {
    appid: appId,
    screenshots,
    videos,
    title: (game.name as string) || "",
    header_image: (game.header_image as string) || null,
    short_description: (game.short_description as string) || null,
    long_description: (game.detailed_description as string) || null,
    type: (game.type as string) || "game",
    raw: game, // Raw Steam API response
  };
}

/**
 * Fetch Steam game data from a Steam URL.
 * Uses global rate limiting (2s between requests) and retry with exponential backoff.
 *
 * @param steamUrl - Steam store URL or app ID
 * @returns Promise resolving to game data
 */
export async function fetchSteamGame(steamUrl: string): Promise<SteamGameData> {
  return retry(
    () => fetchGameDataWithRateLimit(steamUrl),
    {
      maxAttempts: 5,
      initialDelayMs: 3000, // Start with 3s delay on retry (after rate limit)
      maxDelayMs: 30000, // Max 30s delay
      backoffMultiplier: 2,
      retryable: (error: unknown) => {
        // Retry on rate limit errors
        if (error instanceof SteamRateLimitError) {
          console.log("[STEAM] Rate limited, will retry with backoff...");
          return true;
        }
        // Retry on network errors
        if (error instanceof TypeError && String(error).includes("fetch")) {
          return true;
        }
        // Don't retry on other errors (invalid URL, game not found, etc.)
        return false;
      },
    }
  );
}

// ============================================================================
// Validation & Search
// ============================================================================

/**
 * Validate an app ID by trying to fetch it from Steam.
 * Returns false for DLCs, mods, demos, or non-existent games.
 * Only returns true (assume valid) for rate limit errors to avoid skipping valid games.
 */
export async function validateAppId(appId: number): Promise<boolean> {
  try {
    const game = await fetchSteamGame(appId.toString());
    // Only reject DLCs, demos, mods, etc. - not actual games
    if (game.type !== "game") {
      console.log(`[STEAM] Rejected ${appId}: type is "${game.type}"`);
      return false;
    }
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Rate limit errors: assume valid (don't skip valid games due to rate limiting)
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      console.log(`[STEAM] Rate limited for ${appId}, assuming valid`);
      return true;
    }

    // "Not found" errors: game doesn't exist, trigger fallback search
    if (errorMessage.includes("not found") || errorMessage.includes("unavailable")) {
      console.log(`[STEAM] App ${appId} not found, will try title search`);
      return false;
    }

    // Other errors (network, timeout): assume valid to avoid false rejections
    console.log(`[STEAM] Validation error for ${appId}, assuming valid:`, errorMessage);
    return true;
  }
}

/**
 * Validate an app ID AND verify it matches the expected title.
 * Returns { valid: true, actualTitle } if the app exists and is a game.
 * Returns { valid: false } if not found, wrong type, or title mismatch.
 */
export async function validateAppIdWithTitle(
  appId: number,
  expectedTitle: string
): Promise<{ valid: boolean; actualTitle?: string; titleMatch?: boolean }> {
  try {
    const game = await fetchSteamGame(appId.toString());
    
    // Reject DLCs, demos, mods, etc.
    if (game.type !== "game") {
      console.log(`[STEAM] Rejected ${appId}: type is "${game.type}"`);
      return { valid: false };
    }
    
    // Check if the title matches (case-insensitive, fuzzy)
    const titleMatch = isTitleMatch(expectedTitle, game.title);
    
    if (!titleMatch) {
      console.log(`[STEAM] Title mismatch for ${appId}: expected "${expectedTitle}", got "${game.title}"`);
    }
    
    return { valid: true, actualTitle: game.title, titleMatch };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Rate limit errors: assume valid but unknown title match
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      console.log(`[STEAM] Rate limited for ${appId}, assuming valid`);
      return { valid: true, titleMatch: true }; // Assume match to avoid false rejections
    }

    // "Not found" errors: game doesn't exist
    if (errorMessage.includes("not found") || errorMessage.includes("unavailable")) {
      console.log(`[STEAM] App ${appId} not found`);
      return { valid: false };
    }

    // Other errors: assume valid but unknown title match
    console.log(`[STEAM] Validation error for ${appId}, assuming valid:`, errorMessage);
    return { valid: true, titleMatch: true };
  }
}

/**
 * Check if two game titles match (fuzzy comparison).
 * Handles cases like "Tetris Effect: Connected" vs "Tetris® Effect: Connected"
 */
function isTitleMatch(expected: string, actual: string): boolean {
  // Normalize both titles
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[®™©]/g, "") // Remove trademark symbols
      .replace(/[:\-–—]/g, " ") // Normalize separators
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim();

  const normExpected = normalize(expected);
  const normActual = normalize(actual);

  // Exact match after normalization
  if (normExpected === normActual) return true;

  // Check if one contains the other (for subtitle variations)
  if (normActual.includes(normExpected) || normExpected.includes(normActual)) {
    return true;
  }

  // Check word overlap (at least 60% of words match)
  const expectedWords = new Set(normExpected.split(" ").filter(w => w.length > 2));
  const actualWords = new Set(normActual.split(" ").filter(w => w.length > 2));
  
  if (expectedWords.size === 0 || actualWords.size === 0) return false;
  
  let matches = 0;
  for (const word of expectedWords) {
    if (actualWords.has(word)) matches++;
  }
  
  const overlapRatio = matches / Math.min(expectedWords.size, actualWords.size);
  return overlapRatio >= 0.6;
}

/**
 * Search for app ID by game title using Steam search API.
 */
export async function searchAppIdByTitle(title: string): Promise<number | null> {
  try {
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=US&l=en`;
    const searchResponse = await fetch(searchUrl);

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.items && searchData.items.length > 0) {
        const appId = searchData.items[0].id;
        console.log(`[STEAM] Found "${title}" → ${appId}`);
        return appId;
      }
    }
  } catch (error) {
    console.warn(`[STEAM] Search failed for "${title}":`, error);
  }

  console.log(`[STEAM] No match found for "${title}"`);
  return null;
}
