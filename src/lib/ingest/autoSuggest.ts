import { generateText } from "ai";
import { supabase } from "../supabase/server";

// Steam API rate limiting - wait 2 seconds between requests to avoid 403 blocks
const STEAM_RATE_LIMIT_MS = 2000;

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get community suggestions for a game using Perplexity
 */
async function getSuggestions(gameName: string): Promise<string[]> {
  console.log("[AUTO-SUGGEST] Getting suggestions for:", gameName);
  
  try {
    const result = await generateText({
      model: "perplexity/sonar-pro",
      prompt: `Search Reddit, Steam forums, and gaming communities for INDIE games that players recommend as VISUALLY and AESTHETICALLY similar to "${gameName}".

PRIORITIZE:
- Indie games and smaller studio releases
- Hidden gems that look similar but are less well-known
- Games from solo developers or small teams

Focus on games that LOOK similar - same art style, graphics fidelity, color palette, mood.

AVOID suggesting other AAA games or major studio releases. We want to help players discover indie alternatives.

Return exactly 5 specific Steam game titles, one per line. Just the names, no explanations or numbers.`,
    });

    const suggestions = result.text
      .split("\n")
      .map(line => line
        .replace(/^\d+\.\s*/, "")  // Remove numbered list prefixes
        .replace(/\[\d+\]/g, "")    // Remove citation markers like [1], [2]
        .replace(/\*\*/g, "")       // Remove markdown bold
        .trim()
      )
      .filter(line => line.length > 0 && line.length < 100);

    console.log("[AUTO-SUGGEST] Found suggestions:", suggestions);
    return suggestions;
  } catch (error) {
    console.error("[AUTO-SUGGEST] Error getting suggestions:", error);
    return [];
  }
}

/**
 * Search Steam for a game by name and return the app ID
 * @returns app ID or null if not found. Returns -1 if rate limited (403/429)
 */
async function searchSteamGame(gameName: string): Promise<number | null | -1> {
  try {
    // Rate limit: wait before making Steam API call
    await delay(STEAM_RATE_LIMIT_MS);

    // Use Steam's search API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      gameName
    )}&cc=us&l=en`;
    const response = await fetch(searchUrl);

    // Check for rate limiting
    if (response.status === 403 || response.status === 429) {
      console.error(
        `[AUTO-SUGGEST] ❌ Steam API rate limited (${response.status}) for "${gameName}"`
      );
      console.error(
        "[AUTO-SUGGEST] Stopping auto-suggestions to avoid IP ban. Wait before trying again."
      );
      return -1; // Special value to indicate rate limit
    }

    if (!response.ok) {
      console.warn(
        `[AUTO-SUGGEST] Steam API error ${response.status} for "${gameName}"`
      );
      return null;
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      // Filter out DLCs - Steam search returns items with type field
      const nonDLCItems = data.items.filter(
        (item: any) =>
          item.type !== "dlc" &&
          !item.type?.toLowerCase().includes("dlc") &&
          !item.name?.toLowerCase().includes("dlc")
      );

      if (nonDLCItems.length === 0) {
        console.log(
          `[AUTO-SUGGEST] Only DLC found for "${gameName}", skipping`
        );
        return null;
      }

      // Return first non-DLC match
      const appId = nonDLCItems[0].id;
      console.log(`[AUTO-SUGGEST] Found Steam ID for "${gameName}": ${appId}`);
      return appId;
    }

    console.log(`[AUTO-SUGGEST] No Steam match found for "${gameName}"`);
    return null;
  } catch (error) {
    console.error(
      `[AUTO-SUGGEST] Error searching Steam for "${gameName}":`,
      error
    );
    return null;
  }
}

/**
 * Check if a game already exists in the database
 */
async function gameExists(appId: number): Promise<boolean> {
  const { data } = await supabase
    .from("games")
    .select("id")
    .eq("id", appId)
    .single();
  return !!data;
}

/**
 * Auto-ingest community suggestions for a game.
 * This runs in the background after a game is ingested.
 */
/**
 * Auto-ingest community suggestions for a game.
 * This runs in the background after a game is ingested.
 * 
 * Rate limiting strategy:
 * - Limits to 3 suggestions per game to avoid overwhelming Steam API
 * - 2 second delay between each Steam API call
 * - Stops immediately if rate limited (403/429) to prevent IP ban
 */
export async function autoIngestSuggestions(
  gameName: string,
  ingestFn: (steamUrl: string) => Promise<any>
): Promise<void> {
  console.log("\n[AUTO-SUGGEST] Starting auto-suggestion ingestion for:", gameName);
  
  try {
    // Get community suggestions
    const suggestions = await getSuggestions(gameName);

    if (suggestions.length === 0) {
      console.log("[AUTO-SUGGEST] No suggestions found");
      return;
    }

    // Process each suggestion (limit to 3 to avoid overwhelming Steam API)
    // Steam has strict rate limits - processing more risks 403 IP ban
    const maxSuggestions = 3;
    const suggestionsToProcess = suggestions.slice(0, maxSuggestions);

    if (suggestions.length > maxSuggestions) {
      console.log(
        `[AUTO-SUGGEST] Processing ${maxSuggestions} of ${suggestions.length} suggestions (rate limit protection)`
      );
    }

    for (const suggestion of suggestionsToProcess) {
      try {
        // Search for Steam ID (with rate limiting built-in)
        const appId = await searchSteamGame(suggestion);

        // Check if we hit a rate limit
        if (appId === -1) {
          console.error(
            `[AUTO-SUGGEST] ⚠️  Rate limited - stopping auto-suggestions for "${gameName}"`
          );
          console.error(
            "[AUTO-SUGGEST] Some suggestions were skipped. Try again later."
          );
          break; // Stop processing remaining suggestions
        }

        if (!appId) {
          console.log(
            `[AUTO-SUGGEST] Skipping "${suggestion}" - not found on Steam`
          );
          continue;
        }

        // Check if already in database
        const exists = await gameExists(appId);
        if (exists) {
          console.log(
            `[AUTO-SUGGEST] Skipping "${suggestion}" (${appId}) - already in database`
          );
          continue;
        }

        // Ingest the suggested game (this will also make Steam API calls, so delay first)
        console.log(
          `[AUTO-SUGGEST] Queueing ingestion for "${suggestion}" (${appId})...`
        );
        const steamUrl = `https://store.steampowered.com/app/${appId}/`;

        // Add delay before ingestion to space out Steam API calls
        await delay(STEAM_RATE_LIMIT_MS);

        // Fire and forget - don't wait for completion
        ingestFn(steamUrl).catch((err) => {
          // Check if it's a rate limit error
          if (
            err?.message?.includes("403") ||
            err?.message?.includes("rate limit")
          ) {
            console.error(
              `[AUTO-SUGGEST] ⚠️  Rate limited during ingestion of "${suggestion}"`
            );
          } else {
            console.error(
              `[AUTO-SUGGEST] Error ingesting "${suggestion}":`,
              err
            );
          }
        });
      } catch (error) {
        console.error(
          `[AUTO-SUGGEST] Error processing "${suggestion}":`,
          error
        );
      }
    }

    console.log("[AUTO-SUGGEST] Finished queueing suggestions for:", gameName);
  } catch (error) {
    console.error("[AUTO-SUGGEST] Error in auto-suggestion:", error);
  }
}
