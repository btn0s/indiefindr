import { generateText } from "ai";
import { retry } from "./utils/retry";
import { validateAppIdWithTitle, searchAppIdByTitle } from "./steam";
import { Suggestion } from "./supabase/types";
import { isLikelyIndieFromRaw, isRecentFromRaw } from "./utils/indie-detection";

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
    text ? ` and the following context: "${text}"` : ""
  }, find Steam games that are similar to what you see.

Return 8-12 similar Steam games in this EXACT format (one game per line):

title, steam_appid, explanation

CRITICAL REQUIREMENTS - INDIE-FIRST APPROACH:
- STRICTLY prioritize indie games (independent developers, smaller studios, lesser-known titles)
- Target ALL indie games; allow at most 1-2 non-indie games ONLY if absolutely unavoidable for relevance
- AVOID AAA tentpoles and major franchise titles (EA, Ubisoft, Activision, Take-Two, etc.) even if they seem similar
- If the source game is AAA, still surface indie games that match on mechanics, vibe, art direction, camera perspective, combat loop, pacing, or tone
- Prefer smaller, lesser-known Steam games over obvious household-name matches

RECENCY MIX:
- Include 2-3 indie picks that are released or announced in the last 6 months (must have a Steam store page)
- These can be newly launched, recently announced, or fresh early access titles
- They should still match the image/context, but can be more "under-the-radar" discoveries
- For recency picks, optionally mention in the explanation why it's timely (e.g., "recently launched", "newly announced", "fresh early access")

IMPORTANT: Each explanation MUST explain WHY you chose this game - what makes it relate to the image/context.

TONE & TENSE: Write explanations in a friendly, conversational way. Always use present tense verbs (shares, features, matches, offers, brings, captures). Be consistent—every explanation should follow the same structure.

Good examples (consistent present tense, indie-focused):
Hades, 1145360, Features fast-paced roguelike combat with Greek mythology themes and stunning hand-drawn visuals
Celeste, 504230, Delivers challenging platforming mechanics with a heartfelt narrative and pixel art style
Dead Cells, 588650, Offers similar roguelike-metroidvania gameplay with fluid combat and procedurally generated levels
Cuphead, 268910, Captures the same hand-drawn animation aesthetic with challenging boss-focused gameplay
Hollow Knight, 367520, Shares the same atmospheric metroidvania exploration with beautiful hand-drawn art

Bad examples (inconsistent tense - DO NOT USE):
- "Similar competitive FPS gameplay..." (missing verb)
- "Sharing the same mechanics..." (gerund instead of present tense)
- "Because it offers..." (don't start with "because")
- "closely matching the tone..." (gerund)

Each line must have: game title (comma), Steam app ID number (comma), explanation that explains WHY this game relates to the image/context. Use commas to separate the three fields.`;

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

  console.log("[SUGGEST] Validated suggestions:", suggestions);

  return { suggestions };
}

/**
 * Parse suggestions text from Perplexity - expects format: title, steam_appid, explanation
 */
function parseSuggestions(text: string): ParsedSuggestion[] {
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

  const recentIndie: Suggestion[] = [];
  const indie: Suggestion[] = [];
  const nonIndie: Suggestion[] = [];

  for (const v of validated) {
    const raw = v.raw;
    const likelyIndie = raw ? isLikelyIndieFromRaw(raw) : false;
    const recent = raw ? isRecentFromRaw(raw, 6) : false;

    if (likelyIndie && recent) recentIndie.push(v.suggestion);
    else if (likelyIndie) indie.push(v.suggestion);
    else nonIndie.push(v.suggestion);
  }

  const picked: Suggestion[] = [];
  const seen = new Set<number>();

  const pushUnique = (s: Suggestion) => {
    if (seen.has(s.appId)) return;
    seen.add(s.appId);
    picked.push(s);
  };

  for (const s of recentIndie) pushUnique(s);
  for (const s of indie) pushUnique(s);

  const remaining = 12 - picked.length;
  if (remaining > 0) {
    for (const s of nonIndie.slice(0, Math.min(2, remaining))) pushUnique(s);
  }

  return picked;
}
