import type { GameNew } from "@/lib/supabase/types";

/**
 * Major AAA publishers/developers that we want to avoid prioritizing
 */
const MAJOR_PUBLISHERS = new Set([
  "electronic arts",
  "ea",
  "ubisoft",
  "activision",
  "activision blizzard",
  "take-two interactive",
  "rockstar games",
  "2k games",
  "warner bros",
  "warner bros. interactive entertainment",
  "warner bros interactive",
  "sony interactive entertainment",
  "playstation",
  "microsoft",
  "xbox game studios",
  "nintendo",
  "bethesda",
  "zenimax",
  "square enix",
  "capcom",
  "bandai namco",
  "bandai namco entertainment",
  "sega",
  "konami",
  "namco",
  "thq",
  "thq nordic",
  "focus home interactive",
  "paradox interactive",
  "wargaming",
  "riot games",
  "blizzard entertainment",
  "valve",
  "epic games",
]);

/**
 * Steam categories/tags that indicate indie games
 */
const INDIE_TAGS = new Set([
  "indie",
  "indie game",
  "independent",
]);

/**
 * Check if a game is likely indie based on Steam metadata.
 * Uses heuristics: avoids major publishers, checks for indie tags, prefers smaller studios.
 */
export function isLikelyIndie(game: GameNew): boolean {
  if (!game.raw || typeof game.raw !== "object") {
    // If we don't have raw data, assume indie (safer default for our use case)
    return true;
  }

  const raw = game.raw as {
    publishers?: string[];
    developer?: string;
    developers?: string[];
    genres?: Array<{ id: number; description: string }>;
    categories?: Array<{ id: number; description: string }>;
  };

  // Check publishers
  const publishers = raw.publishers || [];
  const publisherNames = publishers.map((p) => p.toLowerCase().trim());
  for (const pub of publisherNames) {
    if (MAJOR_PUBLISHERS.has(pub)) {
      return false;
    }
  }

  // Check developers
  const developers = raw.developers || (raw.developer ? [raw.developer] : []);
  const developerNames = developers.map((d) => d.toLowerCase().trim());
  for (const dev of developerNames) {
    if (MAJOR_PUBLISHERS.has(dev)) {
      return false;
    }
  }

  // Check for indie tags/categories
  const allTags: string[] = [];
  if (raw.genres) {
    allTags.push(...raw.genres.map((g) => g.description.toLowerCase()));
  }
  if (raw.categories) {
    allTags.push(...raw.categories.map((c) => c.description.toLowerCase()));
  }

  for (const tag of allTags) {
    if (INDIE_TAGS.has(tag)) {
      return true;
    }
  }

  // If no major publisher/developer found, assume indie (safer default)
  // This handles cases where metadata might be incomplete
  return publishers.length === 0 || !publisherNames.some((p) => MAJOR_PUBLISHERS.has(p));
}

/**
 * Get release date from Steam raw data (if available).
 * Returns null if not found or invalid.
 */
export function getReleaseDate(game: GameNew): Date | null {
  if (!game.raw || typeof game.raw !== "object") {
    return null;
  }

  const raw = game.raw as {
    release_date?: { date?: string };
  };

  const dateStr = raw.release_date?.date;
  if (!dateStr) return null;

  // Steam dates can be "Coming soon" or actual dates like "Jan 1, 2024"
  if (dateStr.toLowerCase().includes("coming soon")) {
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Check if a game was released or announced in the last N months.
 */
export function isRecent(game: GameNew, monthsAgo: number = 6): boolean {
  const releaseDate = getReleaseDate(game);
  if (!releaseDate) return false;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);

  return releaseDate >= cutoffDate;
}

/**
 * Sort suggestions to prioritize indie games, with recent indie games first.
 * 
 * @param suggestions - Array of suggestions with game data
 * @returns Sorted array: recent indie games first, then other indie games, then non-indie
 */
export function sortSuggestionsByIndiePriority<T extends { appId: number; explanation?: string }>(
  suggestions: T[],
  gamesById: Record<number, GameNew>
): T[] {
  return [...suggestions].sort((a, b) => {
    const gameA = gamesById[a.appId];
    const gameB = gamesById[b.appId];

    // If we don't have game data, keep original order
    if (!gameA || !gameB) return 0;

    const indieA = isLikelyIndie(gameA);
    const indieB = isLikelyIndie(gameB);

    const recentA = isRecent(gameA, 6);
    const recentB = isRecent(gameB, 6);

    // Priority order:
    // 1. Recent indie games (highest priority)
    // 2. Other indie games
    // 3. Non-indie games (lowest priority)

    // Both are recent indie - keep original order (or sort by recency if needed)
    if (recentA && indieA && recentB && indieB) {
      return 0; // Keep original order
    }

    // A is recent indie, B is not
    if (recentA && indieA && (!recentB || !indieB)) return -1;

    // B is recent indie, A is not
    if (recentB && indieB && (!recentA || !indieA)) return 1;

    // Both are indie (but not recent) - keep original order
    if (indieA && indieB) return 0;

    // A is indie, B is not
    if (indieA && !indieB) return -1;

    // B is indie, A is not
    if (indieB && !indieA) return 1;

    // Neither is indie - keep original order
    return 0;
  });
}
