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
    const unhelpfulPhrases = [
      "don't have live access",
      "do not have live access",
      "don't have access",
      "i'm not finding",
      "i cannot",
      "i couldn't find",
      "no information available",
      "unable to find",
      "no specific information",
      "limited information",
      "not enough information",
      "couldn't locate",
      "no results",
      "no community discussions",
    ];
    
    if (unhelpfulPhrases.some(phrase => text.includes(phrase))) {
      console.log("[PERPLEXITY] Response was unhelpful, returning null");
      return null;
    }

    // Refine the result to extract only descriptor words
    const refinedDescription = await refinePerplexityResult(result.text);

    // Post-refinement validation: filter out meta/garbage descriptors
    const garbageDescriptors = [
      "live access",
      "current gaming forums",
      "community terminology",
      "representative comments",
      "representative posts",
      "precise phrases",
      "indexed",
      "community-sourced",
      "accurate",
      "current",
      "forums",
      "reddit",
      "twitter",
      "gaming forums",
      "search results",
      "no information",
    ];
    
    const descriptorList = refinedDescription.split(",").map(d => d.trim().toLowerCase());
    const hasGarbage = garbageDescriptors.some(garbage => 
      descriptorList.some(desc => desc.includes(garbage))
    );
    
    if (hasGarbage) {
      console.log("[PERPLEXITY] Refined description contains garbage descriptors, returning null");
      return null;
    }

    // Clean markdown formatting and filter descriptors
    const cleanedDescriptors = refinedDescription
      .replace(/\*\*/g, "") // Remove markdown bold
      .replace(/\*/g, "")   // Remove markdown italic
      .replace(/\[.*?\]/g, "") // Remove markdown links text
      .replace(/\(.*?\)/g, "") // Remove markdown links url
      .split(",")
      .map(d => d.trim())
      .filter(d => d.length >= 3 && d.length <= 40 && !d.includes("..."))
      .join(", ");

    if (!cleanedDescriptors || cleanedDescriptors.length < 10) {
      console.log("[PERPLEXITY] Not enough valid descriptors after cleaning, returning null");
      return null;
    }

    return {
      description: cleanedDescriptors,
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
    `Search Reddit, Twitter, and gaming forums for how players describe the VISUAL STYLE of "{gameName}" BY TODAY'S 2024 STANDARDS.

Answer these questions:
1. GRAPHICS TECH: Is it technically dated (Source engine, PS2/PS3 era, low-poly) OR modern high-fidelity (UE5, photorealistic, AAA graphics)?
2. LIGHTING: Dark/moody/oppressive OR bright/vibrant/open?
3. COLORS: Muted/desaturated/grey-brown OR saturated/colorful/vibrant?
4. THEME: What's the art direction theme? (brutalist, retro-futurism, horror, cozy, etc.)

CRITICAL DISTINCTION:
- "Retro-futurism" or "cassette futurism" = THEME (70s/80s sci-fi aesthetic)
- "Low-poly" or "dated graphics" = TECHNICAL quality
These are different! A modern UE5 game can have a retro-futurist THEME but still be HIGH-FIDELITY technically.

Examples:
- Half-Life 2: dated graphics, low-poly by 2024 standards, moody, desaturated, brutalist
- ARC Raiders: modern high-fidelity UE5, bright open vistas, retro-futurist theme, colorful
- DOOM (2016): modern high-fidelity, dark hellish, saturated reds, industrial horror

Give me a 2-3 sentence summary with accurate technical AND thematic descriptors.`
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
    `Search Reddit, Twitter, and gaming forums for how players and reviewers describe the GAMEPLAY mechanics, genre, and play style of the video game "{gameName}".

Focus ONLY on gameplay terms like:
- Genre (extraction shooter, roguelite, metroidvania, city builder, ARPG, FPS)
- Structure (open world, run-based, session-based, mission-based)
- Mechanics (stealth, crafting, base-building, combo-heavy combat, tactical)
- Pace (fast-paced, slow-burn, methodical, high-APM)

Do NOT include visual/aesthetic terms like "pixel art", "gritty", "neon", etc.

Give me a 2-3 sentence summary using the exact gameplay terminology the community uses.`
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
    `Search Reddit, Twitter, and gaming forums for how players and reviewers describe the NARRATIVE structure, story, tone, and mood of the video game "{gameName}".

Focus ONLY on narrative/mood terms like:
- Story structure (branching narrative, linear story, choice-driven, emergent storytelling)
- Tone (dark fantasy, cozy, horror, noir, comedic, bittersweet)
- Themes (moral ambiguity, survival, political intrigue, found family)
- Mood (bleak, oppressive, whimsical, tense, atmospheric)

Do NOT include gameplay terms or visual/aesthetic terms.

Give me a 2-3 sentence summary using the exact narrative terminology the community uses.`
  );
}
