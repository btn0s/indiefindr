import { generateText } from "ai";
import { retry } from "./utils/retry";
import { validateAppIdWithTitle, searchAppIdByTitle } from "./steam";
import { Suggestion } from "./supabase/types";

const SONAR_MODEL = "perplexity/sonar-pro";

export type SuggestGamesResult = {
  suggestions: Suggestion[];
};

export type ParsedSuggestion = {
  title: string;
  appId: number | null;
  explanation: string;
};

/**
 * Suggest similar games based on an image and optional text context.
 * Uses Perplexity to search for games similar to the provided image.
 */
export async function suggestGames(
  image: string,
  text?: string
): Promise<SuggestGamesResult> {
  if (!image || typeof image !== "string") {
    throw new Error("image (string) is required. Provide base64 data URL or image URL.");
  }

  console.log("[SUGGEST] Starting search");

  const basePrompt = `Based on this image${
    text ? ` and the following context:\n\n${text}\n` : ""
  }\nfind Steam games that are similar to what you see.

SEARCH STRATEGY (important for new/obscure games):
- Do NOT rely only on the game's title. Use the Steam metadata + keyword hints in the context to infer genre, mechanics, and vibe.
- Use the suggested search queries (if provided) as starting points to dig for similar games, even when the title has limited coverage online.
- Prioritize matching on mechanics, perspective, art direction, pacing, and tone over exact name similarity.

Return 8-12 similar Steam games as a JSON array. Use this EXACT format (no markdown, no code fences, just raw JSON):

[
  {"title": "Game Title", "steam_appid": 123456, "explanation": "Why this game relates..."},
  {"title": "Another Game", "steam_appid": 789012, "explanation": "Why this game relates..."}
]

CRITICAL REQUIREMENTS - INDIE-ONLY FOCUS:
- RETURN ONLY INDIE GAMES. Independent developers, smaller studios, lesser-known titles, solo developers, small teams.
- DO NOT include AAA games, major publishers (EA, Ubisoft, Activision, Take-Two, Nintendo, Sony, Microsoft, etc.), or well-known franchise titles.
- Even if AAA games seem similar, find indie alternatives that match on mechanics, vibe, art direction, camera perspective, combat loop, pacing, or tone.
- Prioritize lesser-known indie games over popular indie titles when possible.
- If you cannot find enough indie games that match, return fewer suggestions rather than including AAA/non-indie games.

RECENCY PRIORITY:
- Prioritize indie games released or announced in the last 6 months (must have a Steam store page).
- Include newly launched indie games, recently announced indie titles, and fresh indie early access games.
- These should still match the image/context, but can be more "under-the-radar" discoveries.
- For recent picks, mention in the explanation why it's timely (e.g., "recently launched", "newly announced", "fresh early access").

IMPORTANT: Each explanation MUST explain WHY you chose this game - what makes it relate to the image/context.

CRITICAL: NEVER include Steam app IDs or numeric identifiers in the explanation field. The explanation should only contain descriptive text about why the game is similar.

TONE & TENSE: Write explanations in a friendly, conversational way. Always use present tense verbs (shares, features, matches, offers, brings, captures). Be consistent—every explanation should follow the same structure.

Good examples (consistent present tense, indie-focused):
{"title": "Hades", "steam_appid": 1145360, "explanation": "Features fast-paced roguelike combat with Greek mythology themes and stunning hand-drawn visuals"}
{"title": "Celeste", "steam_appid": 504230, "explanation": "Delivers challenging platforming mechanics with a heartfelt narrative and pixel art style"}
{"title": "Dead Cells", "steam_appid": 588650, "explanation": "Offers similar roguelike-metroidvania gameplay with fluid combat and procedurally generated levels"}

Bad examples (inconsistent tense - DO NOT USE):
- "Similar competitive FPS gameplay..." (missing verb)
- "Sharing the same mechanics..." (gerund instead of present tense)
- "Because it offers..." (don't start with "because")
- "closely matching the tone..." (gerund)

Return ONLY valid JSON. Do not include markdown code fences, explanations, or any text outside the JSON array.`;

  // Handle both base64 and URLs
  let imageUrl = image;
  if (!image.startsWith("data:") && !image.startsWith("http://") && !image.startsWith("https://")) {
    imageUrl = `data:image/jpeg;base64,${image}`;
  }

  const messageContent = [
    { type: "text" as const, text: basePrompt },
    { type: "image" as const, image: imageUrl },
  ];

  console.log("[SUGGEST] Sending request to Perplexity");

  const result = await retry(
    async () => {
      const response = await generateText({
        model: SONAR_MODEL,
        messages: [{ role: "user", content: messageContent }],
      });
      return response;
    },
    {
      maxAttempts: 2,
      initialDelayMs: 1000,
      retryable: (error: unknown) => {
        const err = error as { status?: number; response?: { status?: number } };
        const status = err?.status || err?.response?.status;
        return status === 429 || (status !== undefined && status >= 500);
      },
    }
  );

  console.log("[SUGGEST] Response received");
  console.log("[SUGGEST] Raw text:", result.text);

  const parsed = parseSuggestions(result.text);
  const suggestions = await validateAndCorrectSuggestions(parsed);
  
  // Sanitize explanations before returning
  const sanitizedSuggestions = suggestions.map((s) => ({
    ...s,
    explanation: sanitizeExplanation(s.explanation),
  }));

  console.log("[SUGGEST] Validated suggestions:", sanitizedSuggestions);

  return { suggestions: sanitizedSuggestions };
}

/**
 * Sanitize explanation text by removing:
 * - Leading "actually" (case-insensitive)
 * - Steam-ID-like numbers (6-7 digits)
 * - Game title corrections (e.g., "actually Prodeus, 964120,")
 * - Extra whitespace/punctuation
 */
export function sanitizeExplanation(explanation: string): string {
  if (!explanation) return "";

  let cleaned = explanation.trim();

  // Remove leading "actually" (case-insensitive)
  cleaned = cleaned.replace(/^actually\s+/i, "");

  // Remove patterns like "GameName, 123456," or ", 123456," (corrections with Steam IDs)
  // This handles cases where the model tried to correct itself
  cleaned = cleaned.replace(/[^,\s]+,\s*\b\d{6,7}\b\s*,?\s*/g, "");
  
  // Remove standalone Steam-ID-like numbers (6-7 digits, word boundaries)
  cleaned = cleaned.replace(/\b\d{6,7}\b\s*,?\s*/g, "");

  // Clean up extra whitespace and punctuation
  cleaned = cleaned.replace(/\s+/g, " "); // Multiple spaces to single
  cleaned = cleaned.replace(/\s*,\s*,/g, ","); // Double commas
  cleaned = cleaned.replace(/\s*,\s*$/g, ""); // Trailing comma
  cleaned = cleaned.replace(/^\s*,\s*/g, ""); // Leading comma
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Parse suggestions from Perplexity - tries JSON first, falls back to CSV format
 */
function parseSuggestions(text: string): ParsedSuggestion[] {
  // Try JSON parsing first
  const jsonParsed = parseSuggestionsJson(text);
  if (jsonParsed.length > 0) {
    return jsonParsed;
  }

  // Fallback to CSV parsing
  return parseSuggestionsCsv(text);
}

/**
 * Parse suggestions from JSON format: [{title, steam_appid, explanation}, ...]
 */
function parseSuggestionsJson(text: string): ParsedSuggestion[] {
  try {
    // Try to extract JSON from markdown code fences if present
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Try to find JSON array in the text
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonText = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const items: ParsedSuggestion[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;

      const title = String(item.title || item.name || "").trim();
      const appId = typeof item.steam_appid === "number" 
        ? item.steam_appid 
        : typeof item.appid === "number"
        ? item.appid
        : null;
      const explanation = String(item.explanation || "").trim();

      if (title && appId && appId > 0) {
        items.push({ title, appId, explanation });
      } else if (title && appId === null) {
        // Title without app ID - will be searched later
        items.push({ title, appId: null, explanation });
      }
    }

    return items;
  } catch (error) {
    console.log("[SUGGEST] JSON parse failed, falling back to CSV:", error);
    return [];
  }
}

/**
 * Parse suggestions from CSV format: title, steam_appid, explanation (legacy fallback)
 */
function parseSuggestionsCsv(text: string): ParsedSuggestion[] {
  const items: ParsedSuggestion[] = [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.match(/^(title|example|format)/i));

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());

    if (parts.length >= 3) {
      const title = parts[0].trim();
      const appIdStr = parts[1].trim();
      const explanation = parts.slice(2).join(", ").trim();

      const appId = parseInt(appIdStr, 10);
      if (!isNaN(appId) && appId > 0 && title) {
        items.push({ title, appId, explanation: explanation || "" });
      } else if (title) {
        items.push({ title, appId: null, explanation: explanation || "" });
      }
    } else if (parts.length === 2) {
      const title = parts[0].trim();
      const appIdStr = parts[1].trim();
      const appId = parseInt(appIdStr, 10);
      if (!isNaN(appId) && appId > 0 && title) {
        items.push({ title, appId, explanation: "" });
      }
    }
  }

  return items;
}

/**
 * Validate and correct suggestions from parsed data.
 * Tests each app ID, verifies the title matches, and if invalid/mismatched,
 * tries to find the correct one by searching.
 */
async function validateAndCorrectSuggestions(
  parsedSuggestions: ParsedSuggestion[]
): Promise<Suggestion[]> {
  const validated: Array<{ suggestion: Suggestion; raw?: unknown }> = [];

  for (const suggestion of parsedSuggestions) {
    let appId = suggestion.appId;
    const title = suggestion.title;

    // If no app ID, try searching by title
    if (!appId && title) {
      appId = await searchAppIdByTitle(title);
    }

    // If we have an app ID, validate it AND verify title matches
    if (appId) {
      const result = await validateAppIdWithTitle(appId, title);
      
      if (result.valid && result.titleMatch) {
        // App ID is valid and title matches - use it
        validated.push({
          raw: result.raw,
          suggestion: {
            appId,
            title: result.actualTitle || title,
            explanation: suggestion.explanation,
          },
        });
      } else if (result.valid && !result.titleMatch) {
        // App ID exists but wrong game - search by title instead
        console.log(`[SUGGEST] App ID ${appId} is "${result.actualTitle}", not "${title}" - searching by title`);
        const correctedId = await searchAppIdByTitle(title);
        if (correctedId && correctedId !== appId) {
          // Verify the corrected ID also matches
          const correctedResult = await validateAppIdWithTitle(correctedId, title);
          if (correctedResult.valid && correctedResult.titleMatch !== false) {
            validated.push({
              raw: correctedResult.raw,
              suggestion: {
                appId: correctedId,
                title: correctedResult.actualTitle || title,
                explanation: suggestion.explanation,
              },
            });
          }
        }
      } else {
        // App ID invalid - try to find correct one by title
        console.log(`[SUGGEST] App ID ${appId} invalid, searching for "${title}"`);
        const correctedId = await searchAppIdByTitle(title);
        if (correctedId) {
          const correctedResult = await validateAppIdWithTitle(correctedId, title);
          if (correctedResult.valid) {
            validated.push({
              raw: correctedResult.raw,
              suggestion: {
                appId: correctedId,
                title: correctedResult.actualTitle || title,
                explanation: suggestion.explanation,
              },
            });
          }
        }
      }
    }
  }

  // Return all validated suggestions in order (prompt now handles indie focus)
  // Deduplicate by appId to avoid duplicates
  const picked: Suggestion[] = [];
  const seen = new Set<number>();

  for (const v of validated) {
    if (seen.has(v.suggestion.appId)) continue;
    seen.add(v.suggestion.appId);
    picked.push(v.suggestion);
  }

  return picked;
}
