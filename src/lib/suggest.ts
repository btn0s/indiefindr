import { generateText } from "ai";
import { retry } from "./utils/retry";

const SONAR_MODEL = "perplexity/sonar-pro";

export type SuggestGamesResult = {
  result: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
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
    throw new Error("image (string) is required. Provide base64 data URL or image URL.");
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

Example:
Counter-Strike 2, 730, Similar competitive FPS gameplay
Team Fortress 2, 440, Same team-based shooter mechanics
Dota 2, 570, Similar MOBA gameplay and visual style

Each line must have: game title (comma), Steam app ID number (comma), brief explanation of similarities. Use commas to separate the three fields.`;

  // Prepare the message content with image
  // Handle both base64 and URLs
  let imageUrl = image;
  if (!image.startsWith("data:") && !image.startsWith("http://") && !image.startsWith("https://")) {
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

  console.log("[SUGGEST] Response received:");
  console.log("[SUGGEST] Raw text:", result.text);
  console.log("[SUGGEST] Usage:", JSON.stringify(result.usage, null, 2));
  console.log("[SUGGEST] Full response:", JSON.stringify(result, null, 2));

  return {
    result: result.text,
    usage: result.usage
      ? {
          inputTokens:
            (result.usage as any).promptTokens ??
            (result.usage as any).inputTokens ??
            0,
          outputTokens:
            (result.usage as any).completionTokens ??
            (result.usage as any).outputTokens ??
            0,
          totalTokens:
            (result.usage as any).totalTokens ??
            ((result.usage as any).promptTokens ?? 0) +
              ((result.usage as any).completionTokens ?? 0),
        }
      : undefined,
  };
}
