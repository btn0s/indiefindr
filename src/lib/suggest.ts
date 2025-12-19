import { generateText } from "ai";
import { retry } from "./utils/retry";
import { fetchSteamGame } from "./steam";
import { Suggestion } from "./supabase/types";

const SONAR_MODEL = "perplexity/sonar-pro";

export type SuggestGamesResult = {
  suggestions: Suggestion[]; // Validated suggestions with explanations
};

export type ParsedSuggestion = {
  title: string;
  appId: number | null;
  explanation: string;
};

/**
 * Suggest similar games based on an image and optional text context.
 * Uses Perplexity to search for games similar to the provided image.
 *
 * @param image - Base64 image data (data:image/...) or image URL
 * @param text - Optional text context about the game
 * @returns Promise resolving to search results with similar games and platforms
 */
export async function suggestGames(
  image: string,
  text?: string
): Promise<SuggestGamesResult> {
  if (!image || typeof image !== "string") {
    throw new Error(
      "image (string) is required. Provide base64 data URL or image URL."
    );
  }

  console.log("[SUGGEST] Starting search");
  console.log("[SUGGEST] Image provided:", image.substring(0, 50) + "...");
  console.log("[SUGGEST] Optional text:", text || "(none)");

  // Build the prompt with structured format requirements
  const basePrompt = `Based on this image${
    text ? ` and the following context: "${text}"` : ""
  }, find Steam games that are similar to what you see.

Return 8-12 similar Steam games in this EXACT format (one game per line):

title, steam_appid, explanation

IMPORTANT: Each explanation MUST explain WHY you chose this game - what makes it relate to the image/context.

TONE & TENSE: Write explanations in a friendly, conversational way. Always use present tense verbs (shares, features, matches, offers, brings, captures). Be consistent—every explanation should follow the same structure.

Good examples (consistent present tense):
Counter-Strike 2, 730, Shares the same competitive FPS gameplay with tactical team-based combat
Team Fortress 2, 440, Features team-based shooter mechanics and class-based gameplay
Dota 2, 570, Offers similar strategic depth with MOBA gameplay and a matching visual style
Half-Life 2, 220, Delivers the same immersive single-player FPS experience

Bad examples (inconsistent tense - DO NOT USE):
- "Similar competitive FPS gameplay..." (missing verb)
- "Sharing the same mechanics..." (gerund instead of present tense)
- "Because it offers..." (don't start with "because")
- "closely matching the tone..." (gerund)

Each line must have: game title (comma), Steam app ID number (comma), explanation that explains WHY this game relates to the image/context. Use commas to separate the three fields.`;

  // Prepare the message content with image
  // Handle both base64 and URLs
  let imageUrl = image;
  if (
    !image.startsWith("data:") &&
    !image.startsWith("http://") &&
    !image.startsWith("https://")
  ) {
    // If it's just base64 without data URL prefix, add it
    imageUrl = `data:image/jpeg;base64,${image}`;
  }

  const messageContent = [
    { type: "text" as const, text: basePrompt },
    { type: "image" as const, image: imageUrl },
  ];

  console.log("[SUGGEST] Sending request to Perplexity");
  console.log("[SUGGEST] Model:", SONAR_MODEL);

  // Call Perplexity with retry logic
  const result = await retry(
    async () => {
      const response = await generateText({
        model: SONAR_MODEL,
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
      });
      return response;
    },
    {
      maxAttempts: 2,
      initialDelayMs: 1000,
      retryable: (error: unknown) => {
        const err = error as {
          status?: number;
          response?: { status?: number };
        };
        const status = err?.status || err?.response?.status;
        return status === 429 || (status !== undefined && status >= 500);
      },
    }
  );

  console.log("[SUGGEST] Response received");
  console.log("[SUGGEST] Raw text:", result.text);

  // Parse and validate suggestions (with explanations)
  const parsed = parseSuggestions(result.text);
  const suggestions = await validateAndCorrectSuggestions(parsed);

  console.log("[SUGGEST] Validated suggestions:", suggestions);

  return { suggestions };
}

/**
 * Parse suggestions text from Perplexity - expects format: title, steam_appid, explanation
 */
function parseSuggestions(text: string): ParsedSuggestion[] {
  const items: ParsedSuggestion[] = [];

  // Split by newlines
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.match(/^(title|example|format)/i)); // Skip header lines

  for (const line of lines) {
    // Parse format: title, steam_appid, explanation
    // Handle commas that might be in the title or explanation by splitting carefully
    const parts = line.split(",").map((p) => p.trim());

    if (parts.length >= 2) {
      // Title is everything before the last 2 parts
      const title = parts.slice(0, -2).join(", ").trim();
      const appIdStr = parts[parts.length - 2];
      const explanation = parts[parts.length - 1];

      const appId = parseInt(appIdStr, 10);
      if (!isNaN(appId) && appId > 0 && title) {
        items.push({
          title,
          appId,
          explanation: explanation || "",
        });
      } else if (title) {
        // Title but no valid app ID
        items.push({
          title,
          appId: null,
          explanation: explanation || "",
        });
      }
    }
  }

  return items;
}

/**
 * Validate and correct suggestions from parsed data.
 * Tests each app ID, and if invalid, tries to find the correct one by searching.
 * Returns validated suggestions with explanations preserved.
 */
async function validateAndCorrectSuggestions(
  parsedSuggestions: ParsedSuggestion[]
): Promise<Suggestion[]> {
  const validatedSuggestions: Suggestion[] = [];

  for (const suggestion of parsedSuggestions) {
    let appId = suggestion.appId;

    // If no app ID, try searching by title
    if (!appId && suggestion.title) {
      appId = await searchAppIdByTitle(suggestion.title);
    }

    // If we have an app ID, validate it
    if (appId) {
      const isValid = await validateAppId(appId);
      if (isValid) {
        validatedSuggestions.push({
          appId,
          explanation: suggestion.explanation,
        });
      } else {
        // Try to find correct app ID by title
        console.log(
          `[SUGGEST] App ID ${appId} invalid, searching for "${suggestion.title}"`
        );
        const correctedId = await searchAppIdByTitle(suggestion.title);
        if (correctedId) {
          validatedSuggestions.push({
            appId: correctedId,
            explanation: suggestion.explanation,
          });
        }
      }
    }
  }

  return validatedSuggestions;
}

/**
 * Validate an app ID by trying to fetch it from Steam.
 * Returns false for DLCs, mods, demos, etc.
 * On network/rate limit errors, returns true (assume valid, will verify later during ingest).
 */
async function validateAppId(appId: number): Promise<boolean> {
  try {
    const game = await fetchSteamGame(appId.toString());
    // Only reject DLCs, demos, mods, etc. - not actual games
    if (game.type !== "game") {
      console.log(`[SUGGEST] Rejected ${appId}: type is "${game.type}"`);
      return false;
    }
    return true;
  } catch (error) {
    // On error, assume valid - we'll verify during ingest
    // This prevents rate limiting from rejecting valid games
    console.log(`[SUGGEST] Validation error for ${appId}, assuming valid:`, 
      error instanceof Error ? error.message : String(error));
    return true;
  }
}

/**
 * Search for app ID by game title using Steam search API
 */
async function searchAppIdByTitle(title: string): Promise<number | null> {
  try {
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=US&l=en`;
    const searchResponse = await fetch(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.items && searchData.items.length > 0) {
        // Return first result without additional validation (to avoid rate limits)
        return searchData.items[0].id;
      }
    }
  } catch (error) {
    console.warn(`[SUGGEST] Steam search failed for "${title}":`, error);
  }
  
  return null;
}
