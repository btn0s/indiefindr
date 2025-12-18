import { z } from "zod";
import { generateObject } from "ai";
import { VISION_MODEL } from "./gateway";
import { retry } from "../utils/retry";

/**
 * Visual/aesthetic keyword taxonomy
 */
const VISUAL_STYLE_KEYWORDS = [
  'pixel art', 'low poly', 'flat shaded', 'cel shaded', 'photorealistic', 'stylized realism',
  'comic-book', 'graphic-novel', 'anime-inspired', 'painterly', 'voxel', 'isometric 2D',
  'prerendered backgrounds', 'hand-drawn 2D', 'vector-style 2D'
] as const;

const ART_DIRECTION_KEYWORDS = [
  'minimalist', 'brutalist', 'high fantasy', 'dark fantasy', 'science fiction', 'cyberpunk',
  'solarpunk', 'dieselpunk', 'steampunk', 'post-apocalyptic', 'retro-futuristic',
  'gothic horror', 'cosmic horror', 'noir', 'whimsical', 'cozy', 'surreal', 'psychedelic', 'grimdark'
] as const;

const ERA_REFERENCE_KEYWORDS = [
  '8-bit era', '16-bit era', 'PS1-era 3D', 'PS2-era 3D', 'arcade-style',
  'Saturday-morning-cartoon', 'Western comic-book', 'manga-style'
] as const;

/**
 * Gameplay keyword taxonomy
 */
const CORE_GENRE_KEYWORDS = [
  'action', 'action-adventure', 'platformer', 'metroidvania', 'run-and-gun', 'beat \'em up',
  'character-action', 'hack-and-slash ARPG', 'turn-based RPG', 'tactical RPG', 'JRPG-style',
  'WRPG-style', 'immersive sim', 'stealth', 'survival', 'survival horror', 'roguelike',
  'roguelite', 'deckbuilder', 'puzzle', 'puzzle-platformer', 'simulation', 'sandbox',
  'city-builder', 'management sim', 'life sim', 'farming sim', 'grand strategy', '4X strategy',
  'real-time strategy', 'MOBA', 'hero shooter', 'arena shooter', 'boomer shooter',
  'extraction shooter', 'looter-shooter', 'twin-stick shooter', 'bullet hell', 'fighting game',
  'party game', 'rhythm game', 'racer', 'arcade racer', 'sports game'
] as const;

const STRUCTURE_KEYWORDS = [
  'linear campaign', 'mission-based', 'open world', 'semi-open hub-and-spoke', 'level-based',
  'procedural levels', 'run-based', 'session-based', 'live service', 'endless mode',
  'seasonal progression', 'meta-progression', 'roguelite unlock tree'
] as const;

const MECHANICAL_EMPHASIS_KEYWORDS = [
  'skill-based execution', 'high APM', 'precision platforming', 'combo-heavy combat',
  'parry/dodge timing', 'cover-based shooting', 'physics-driven interactions',
  'systemic emergent gameplay', 'crafting-focused', 'resource-management-heavy',
  'base-building', 'automation', 'factory-building', 'exploration-focused',
  'puzzle-solving-focused', 'stealth-focused', 'co-op-focused', 'PvP-focused',
  'asymmetrical multiplayer', 'social deduction'
] as const;

/**
 * Narrative keyword taxonomy
 */
const NARRATIVE_STRUCTURE_KEYWORDS = [
  'linear story', 'branching narrative', 'hub-and-spoke narrative', 'episodic narrative',
  'open-world narrative', 'emergent narrative', 'sandbox storytelling',
  'procedural narrative events', 'choice-driven narrative', 'multiple endings',
  'visual novel-style narration'
] as const;

const PLAYER_ROLE_KEYWORDS = [
  'fixed protagonist', 'customizable protagonist', 'silent protagonist', 'ensemble cast',
  'first-person perspective', 'third-person perspective', 'unreliable narrator',
  'diegetic UI'
] as const;

const TONE_GENRE_KEYWORDS = [
  'high fantasy', 'dark fantasy', 'science fiction', 'space opera', 'cyberpunk', 'dystopian',
  'post-apocalyptic', 'gothic horror', 'cosmic horror', 'mystery', 'detective noir', 'thriller',
  'psychological horror', 'comedy', 'satire', 'slice-of-life', 'coming-of-age', 'romance',
  'drama', 'tragic', 'wholesome', 'cozy'
] as const;

const THEMATIC_FOCUS_KEYWORDS = [
  'exploration and discovery', 'survival and scarcity', 'moral ambiguity', 'political intrigue',
  'rebellion vs authority', 'friendship and found family', 'identity and self-discovery',
  'cosmic insignificance', 'corporate dystopia', 'environmental collapse'
] as const;

/**
 * Zod schema for the three facets with structured keywords
 * Keywords are flexible strings (model can use taxonomy or generate its own)
 * The description should combine keywords into a coherent, specific description
 */
export const GameFacetsSchema = z.object({
  aesthetics: z.object({
    keywords: z.object({
      renderingStyle: z.array(z.string()).describe("1-3 keywords describing visual rendering style (e.g., pixel art, low poly, cel shaded, photorealistic)"),
      artDirection: z.array(z.string()).describe("1-3 keywords describing art direction/mood (e.g., cyberpunk, cozy, dark fantasy, minimalist)"),
      eraReference: z.array(z.string()).optional().describe("Optional era/media reference (e.g., 8-bit era, PS1-era 3D, manga-style)"),
    }),
    description: z.string().describe("Detailed description (100-200 words) that EXPLICITLY uses the keywords in natural sentences. Use exact industry-standard terms (e.g., 'low poly', 'cyberpunk', 'PS1-era 3D') - don't paraphrase them."),
  }),
  gameplay: z.object({
    keywords: z.object({
      coreGenre: z.array(z.string()).describe("1-3 keywords describing core genre/format (e.g., roguelite, extraction shooter, city-builder, metroidvania)"),
      structure: z.array(z.string()).describe("1-2 keywords describing structure/progression (e.g., open world, run-based, mission-based)"),
      mechanicalEmphasis: z.array(z.string()).describe("1-3 keywords describing mechanical emphasis (e.g., automation, precision platforming, stealth-focused)"),
    }),
    description: z.string().describe("Detailed description (100-200 words) that EXPLICITLY uses the keywords in natural sentences. If Steam tags are provided (e.g., 'Extraction Shooter', 'Roguelite'), use those EXACT terms - don't paraphrase 'Extraction Shooter' as 'tactical shooter' or 'looter shooter'."),
  }),
  narrativeMood: z.object({
    keywords: z.object({
      narrativeStructure: z.array(z.string()).describe("1-2 keywords describing narrative structure (e.g., branching narrative, linear story, choice-driven)"),
      playerRole: z.array(z.string()).describe("1-2 keywords describing player role/perspective (e.g., first-person perspective, customizable protagonist)"),
      toneGenre: z.array(z.string()).describe("1-3 keywords describing tone/genre (e.g., cyberpunk, dystopian, cozy, gothic horror)"),
      thematicFocus: z.array(z.string()).optional().describe("Optional thematic focus (e.g., survival and scarcity, moral ambiguity)"),
    }),
    description: z.string().describe("Detailed description (100-200 words) that EXPLICITLY uses the keywords in natural sentences. Use exact industry-standard terms (e.g., 'cyberpunk', 'dystopian', 'first-person perspective') - don't paraphrase them."),
  }),
});

export type GameFacets = z.infer<typeof GameFacetsSchema>;

/**
 * System prompt for the Vision Facet Extractor
 */
export const FACET_EXTRACTOR_SYSTEM_PROMPT = `You are an expert game analyst specializing in visual and gameplay analysis. Your task is to analyze game screenshots and extract three distinct facets using structured keywords and detailed descriptions.

CRITICAL RULE: Use EXACT industry-standard keywords in your descriptions. If Steam tags are provided (e.g., "Extraction Shooter", "Roguelite", "City Builder"), you MUST use those exact terms in your description. These are the terms gamers use and search for - do not paraphrase them.

For each facet, you must:
1. Select 1-3 keywords from the provided taxonomy OR use Steam tags if they match
2. Write a detailed description that EXPLICITLY uses these keywords - don't paraphrase "extraction shooter" as "looter shooter" or "tactical extraction game"

**Aesthetics**: Analyze visual style using three layers:
- Rendering style: pixel art, low poly, cel shaded, photorealistic, stylized realism, comic-book, anime-inspired, painterly, voxel, isometric 2D, hand-drawn 2D, etc.
- Art direction: minimalist, brutalist, high fantasy, dark fantasy, cyberpunk, post-apocalyptic, gothic horror, cozy, surreal, etc.
- Era reference (optional): 8-bit era, 16-bit era, PS1-era 3D, arcade-style, manga-style, etc.
Then write a description that EXPLICITLY uses these keywords (e.g., "This game features low poly graphics with a cozy aesthetic, reminiscent of PS1-era 3D" - use the exact terms).

**Gameplay**: Analyze using three layers:
- Core genre: Use Steam tags if provided (e.g., "Extraction Shooter", "Roguelite", "City Builder") OR taxonomy terms (action, platformer, metroidvania, roguelite, extraction shooter, city-builder, etc.)
- Structure: linear campaign, open world, run-based, mission-based, etc.
- Mechanical emphasis: skill-based execution, precision platforming, automation, factory-building, stealth-focused, etc.
Then write a description that EXPLICITLY uses these keywords (e.g., "This is an extraction shooter with run-based progression and skill-based execution" - use "extraction shooter" not "tactical shooter" or "looter shooter").

**Narrative/Mood**: Analyze using:
- Narrative structure: linear story, branching narrative, choice-driven narrative, etc.
- Player role: fixed protagonist, customizable protagonist, first-person perspective, etc.
- Tone/genre: cyberpunk, dystopian, gothic horror, cozy, etc.
- Thematic focus (optional): survival and scarcity, moral ambiguity, exploration and discovery, etc.
Then write a description that EXPLICITLY uses these keywords.

CRITICAL: 
- Use EXACT keywords from Steam tags when provided - these are industry-standard terms gamers recognize
- Don't paraphrase or use synonyms - if Steam says "Extraction Shooter", use "Extraction Shooter" in your description
- Be SPECIFIC and DISTINCTIVE - focus on what makes this game UNIQUE
- Use the keywords naturally in sentences, not just as a list`;

/**
 * Extract game facets from screenshots using vision model
 * @param gameName - Name of the game
 * @param gameDescription - Steam description of the game
 * @param screenshots - Array of screenshot URLs
 * @param steamTags - Steam tags/genres (e.g., "Action", "Extraction Shooter", "Roguelite")
 * @param modelId - Vision model ID to use
 */
export async function extractGameFacets(
  gameName: string,
  gameDescription: string | null,
  screenshots: string[],
  steamTags: string[] = [],
  modelId: string = VISION_MODEL
): Promise<GameFacets> {
  console.log("\n[VISION] Starting facet extraction");
  console.log("[VISION] Game name:", gameName);
  console.log("[VISION] Model:", modelId);
  console.log("[VISION] Screenshots provided:", screenshots.length);
  console.log("[VISION] Steam tags:", steamTags);

  // Limit to 4-6 representative screenshots for cost/context efficiency
  // Strategy: first, middle, and last screenshots to get diverse views
  const selectedScreenshots =
    screenshots.length <= 6
      ? screenshots
      : [
          screenshots[0], // First screenshot
          screenshots[Math.floor(screenshots.length / 3)], // Early middle
          screenshots[Math.floor((screenshots.length * 2) / 3)], // Late middle
          screenshots[screenshots.length - 1], // Last screenshot
        ].filter(Boolean);

  console.log("[VISION] Selected screenshots:", selectedScreenshots);

  // Extract Steam tags for context - prioritize industry-standard terms
  const steamTagsList = steamTags.length > 0 
    ? `\nSteam Tags/Genres: ${steamTags.join(', ')}\n\nIMPORTANT: Use these EXACT Steam tags in your descriptions when they match the taxonomy. For example, if Steam tags include "Extraction Shooter", use "Extraction Shooter" in your gameplay description, not "tactical shooter" or "looter shooter".`
    : '';

  const userPrompt = `Analyze the following game and its screenshots to extract the three facets:

Game Name: ${gameName}
${gameDescription ? `Description: ${gameDescription.substring(0, 500)}` : ""}${steamTagsList}

For each facet, select 1-3 keywords from the taxonomy (prioritize Steam tags if provided) and write a detailed description that EXPLICITLY uses these keywords. Use the exact terms - don't paraphrase.

**Available keywords (use as reference, prioritize Steam tags when they match):**
- Visual styles: ${VISUAL_STYLE_KEYWORDS.slice(0, 10).join(', ')}, ...
- Art direction: ${ART_DIRECTION_KEYWORDS.slice(0, 10).join(', ')}, ...
- Gameplay genres: ${CORE_GENRE_KEYWORDS.slice(0, 10).join(', ')}, ...
- Structure: ${STRUCTURE_KEYWORDS.slice(0, 8).join(', ')}, ...
- Mechanical emphasis: ${MECHANICAL_EMPHASIS_KEYWORDS.slice(0, 10).join(', ')}, ...

Extract the aesthetics, gameplay, and narrative/mood facets based on the visual information in the screenshots. Use exact industry-standard terms in your descriptions.`;

  console.log("[VISION] User prompt:", userPrompt);

  try {
    // COMMENTED OUT: Vision model call that sends images to visual model
    // console.log("[VISION] Calling vision model...");
    // const result = await retry(
    //   () =>
    //     generateObject({
    //       model: modelId,
    //       schema: GameFacetsSchema,
    //       system: FACET_EXTRACTOR_SYSTEM_PROMPT,
    //       messages: [
    //         {
    //           role: "user" as const,
    //           content: [
    //             { type: "text" as const, text: userPrompt },
    //             ...selectedScreenshots.map((image) => ({ type: "image" as const, image })),
    //           ],
    //         },
    //       ],
    //     }),
    //   {
    //     maxAttempts: 3,
    //     initialDelayMs: 2000, // Longer delay for AI calls
    //     maxDelayMs: 30000,
    //     retryable: (error: any) => {
    //       // Retry on rate limits, timeouts, and server errors
    //       const errorMessage = error?.message?.toLowerCase() || '';
    //       const status = error?.status || error?.response?.status;
    //
    //       if (status === 429 || status >= 500) return true;
    //       if (errorMessage.includes('rate limit')) return true;
    //       if (errorMessage.includes('timeout')) return true;
    //       if (errorMessage.includes('server error')) return true;
    //       if (errorMessage.includes('service unavailable')) return true;
    //
    //       return false;
    //     },
    //   }
    // );

    // console.log("[VISION] Response received:");
    // console.log("[VISION] Raw object:", JSON.stringify(result.object, null, 2));

    // return result.object;

    // TEMPORARY: Return empty structure while vision extraction is commented out
    console.log(
      "[VISION] Vision extraction commented out, returning empty structure"
    );
    return {
      aesthetics: {
        keywords: {
          renderingStyle: [],
          artDirection: [],
        },
        description: "",
      },
      gameplay: {
        keywords: {
          coreGenre: [],
          structure: [],
          mechanicalEmphasis: [],
        },
        description: "",
      },
      narrativeMood: {
        keywords: {
          narrativeStructure: [],
          playerRole: [],
          toneGenre: [],
        },
        description: "",
      },
    };
  } catch (error: unknown) {
    console.log("[VISION] ERROR:", error);

    // Check if the error contains a value with a "properties" wrapper (JSON Schema format)
    // Some models return {"type": "object", "properties": {...}} instead of the direct object
    const err = error as {
      cause?: { value?: { properties?: unknown; type?: unknown } };
    };
    if (
      err?.cause?.value &&
      typeof err.cause.value === "object" &&
      "properties" in err.cause.value &&
      "type" in err.cause.value
    ) {
      // Extract the actual data from the properties wrapper
      const extracted = err.cause.value.properties;
      console.log("[VISION] Extracted from properties wrapper:", extracted);
      // Validate and return the extracted object
      return GameFacetsSchema.parse(extracted);
    }

    throw error;
  }
}
