import { generateText } from "ai";
import { retry } from "../utils/retry";

const SONAR_MODEL = "perplexity/sonar-pro";

export type WebGroundedFacet = {
  description: string;
};

/**
 * Refine perplexity search result to extract only descriptor words,
 * removing flare text and personality/narrative elements.
 */
async function refinePerplexityResult(rawDescription: string): Promise<string> {
  console.log("[PERPLEXITY] Refining result to extract descriptor words only");
  console.log("[PERPLEXITY] Raw description:", rawDescription);

  try {
    const refinePrompt = `You are a keyword extractor. Extract ONLY descriptor words and phrases from this text.

STRICT RULES:
1. Extract ONLY adjectives and noun phrases that describe the topic (visual style, gameplay, or narrative)
2. NO verbs (features, brings, portrays, enhances, etc.)
3. NO sentences or complete thoughts
4. NO narrative phrases like "brings to life", "attention to detail", "immersive experience"
5. ONLY words/phrases like: "photorealistic", "post-apocalyptic", "low poly", "cyberpunk", "pixel art", "gritty", "extraction shooter", "roguelite", "branching narrative", "choice-driven", "dark fantasy"
6. Maximum 2-3 words per phrase
7. Return ONLY a comma-separated list with NO other text

BAD examples (DO NOT INCLUDE):
- "features photorealistic graphics" → extract only "photorealistic"
- "brings to life a post-apocalyptic world" → extract only "post-apocalyptic"
- "attention to detail" → skip this entirely
- "enhances the immersive experience" → skip this entirely
- "is an extraction shooter" → extract only "extraction shooter"

GOOD examples:
- "photorealistic, post-apocalyptic, gritty, cinematic, decaying, overgrown"
- "extraction shooter, roguelite, skill-based, run-based"
- "branching narrative, choice-driven, dark fantasy, moral ambiguity"

Text to extract from:
${rawDescription}

Return ONLY comma-separated words/phrases:`;

    const refined = await retry(
      async () => {
        const response = await generateText({
          model: SONAR_MODEL,
          prompt: refinePrompt,
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

    console.log("[PERPLEXITY] Refined description:", refined.text);
    return refined.text;
  } catch (error) {
    console.error("[PERPLEXITY] Refinement error, using original:", error);
    return rawDescription;
  }
}

/**
 * Generic function to search the web for community descriptions of a game facet.
 */
async function searchGameFacet(
  gameName: string,
  facet: "aesthetic" | "gameplay" | "narrative",
  promptTemplate: string
): Promise<WebGroundedFacet | null> {
  console.log(`\n[PERPLEXITY] Starting web ${facet} search`);
  console.log("[PERPLEXITY] Game name:", gameName);
  console.log("[PERPLEXITY] Model:", SONAR_MODEL);

  const prompt = promptTemplate.replace("{gameName}", gameName);
  console.log("[PERPLEXITY] Prompt:", prompt);

  try {
    const result = await retry(
      async () => {
        const response = await generateText({
          model: SONAR_MODEL,
          prompt,
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

    console.log("[PERPLEXITY] Response received:");
    console.log("[PERPLEXITY] Raw text:", result.text);
    console.log("[PERPLEXITY] Usage:", JSON.stringify(result.usage, null, 2));

    // Filter out unhelpful responses (model couldn't find info)
    const text = result.text.toLowerCase();
    if (
      text.includes("don't have live access") ||
      text.includes("i'm not finding") ||
      text.includes("i cannot") ||
      text.includes("i couldn't find") ||
      text.includes("no information available") ||
      text.includes("unable to find")
    ) {
      console.log("[PERPLEXITY] Response was unhelpful, returning null");
      return null;
    }

    // Refine the result to extract only descriptor words
    const refinedDescription = await refinePerplexityResult(result.text);

    return {
      description: refinedDescription,
    };
  } catch (error) {
    console.error(`[PERPLEXITY] ERROR for ${facet}:`, error);
    return null;
  }
}

/**
 * Search the web for how the community describes a game's aesthetic.
 */
export async function searchGameAesthetic(
  gameName: string
): Promise<WebGroundedFacet | null> {
  return searchGameFacet(
    gameName,
    "aesthetic",
    `Search Reddit, Twitter, and gaming forums for how players and reviewers describe the visual aesthetic and art style of the video game "{gameName}". What terms does the community use to describe how it looks? Give me a 2-3 sentence summary using the exact terminology the community uses.`
  );
}

/**
 * Search the web for how the community describes a game's gameplay.
 */
export async function searchGameGameplay(
  gameName: string
): Promise<WebGroundedFacet | null> {
  return searchGameFacet(
    gameName,
    "gameplay",
    `Search Reddit, Twitter, and gaming forums for how players and reviewers describe the gameplay mechanics, genre, and play style of the video game "{gameName}". What terms does the community use to describe how it plays? Give me a 2-3 sentence summary using the exact terminology the community uses (e.g., "extraction shooter", "roguelite", "metroidvania", "city builder").`
  );
}

/**
 * Search the web for how the community describes a game's narrative and mood.
 */
export async function searchGameNarrative(
  gameName: string
): Promise<WebGroundedFacet | null> {
  return searchGameFacet(
    gameName,
    "narrative",
    `Search Reddit, Twitter, and gaming forums for how players and reviewers describe the narrative structure, story style, tone, and mood of the video game "{gameName}". What terms does the community use to describe its storytelling? Give me a 2-3 sentence summary using the exact terminology the community uses (e.g., "branching narrative", "choice-driven", "dark fantasy", "cozy").`
  );
}
