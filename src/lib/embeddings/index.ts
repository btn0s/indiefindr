/**
 * Embedding system for v2 game recommendations
 *
 * This module provides multi-facet embedding generation for games:
 * - AESTHETIC: Visual similarity from screenshots
 * - ATMOSPHERE: Mood and emotional tone
 * - MECHANICS: Gameplay patterns and systems
 * - NARRATIVE: Themes and story
 * - DYNAMICS: Pacing and game feel (future)
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export * from "./types";

// =============================================================================
// EMBEDDING UTILITIES
// =============================================================================

export {
  embedImage,
  embedImages,
  weightedAverageEmbedding,
  normalizeEmbedding,
  cosineSimilarity,
} from "./siglip";

export {
  embedText,
  embedTexts,
  embedTextProjected,
  projectDimensions,
  combineEmbeddings,
  cleanTextForEmbedding,
} from "./text";

// =============================================================================
// TAG UTILITIES
// =============================================================================

export {
  normalizeTag,
  normalizeTags,
  categorizeTags,
  extractSortedTags,
  getTopTags,
  inferPerspective,
  inferGameModes,
  inferSubgenre,
  MECHANIC_TAGS,
  PERSPECTIVE_TAGS,
  MODE_TAGS,
  MOOD_TAGS,
  THEME_TAGS,
  VISUAL_STYLE_TAGS,
  TAG_SYNONYMS,
} from "./tags";

// =============================================================================
// FACET GENERATORS
// =============================================================================

export {
  generateAestheticEmbedding,
  canGenerateAestheticEmbedding,
  getAestheticImageUrls,
} from "./aesthetic";

export {
  generateMechanicsEmbedding,
  canGenerateMechanicsEmbedding,
  buildMechanicsText,
  previewMechanicsTemplate,
} from "./mechanics";

export {
  generateNarrativeEmbedding,
  canGenerateNarrativeEmbedding,
  buildNarrativeText,
  previewNarrativeTemplate,
} from "./narrative";

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

import { generateAestheticEmbedding, canGenerateAestheticEmbedding } from "./aesthetic";
import { generateMechanicsEmbedding, canGenerateMechanicsEmbedding } from "./mechanics";
import { generateNarrativeEmbedding, canGenerateNarrativeEmbedding } from "./narrative";
import type { GameWithIgdb, EmbeddingInput, FacetType } from "./types";

/**
 * Generate all possible embeddings for a game
 *
 * @param game - Game data with optional IGDB enrichment
 * @param facets - Which facets to generate (defaults to all available)
 * @returns Array of embedding inputs ready for storage
 */
export async function generateAllEmbeddings(
  game: GameWithIgdb,
  facets?: FacetType[]
): Promise<EmbeddingInput[]> {
  const results: EmbeddingInput[] = [];
  const targetFacets = facets || ["aesthetic", "mechanics", "narrative"];

  console.log(`\nGenerating embeddings for: ${game.title} (${game.appid})`);
  console.log(`  Target facets: ${targetFacets.join(", ")}`);

  // AESTHETIC
  if (targetFacets.includes("aesthetic") && canGenerateAestheticEmbedding(game)) {
    try {
      const embedding = await generateAestheticEmbedding(game);
      results.push(embedding);
      console.log(`  ✓ AESTHETIC generated`);
    } catch (error) {
      console.error(`  ✗ AESTHETIC failed:`, error);
    }
  }

  // MECHANICS
  if (targetFacets.includes("mechanics") && canGenerateMechanicsEmbedding(game)) {
    try {
      const embedding = await generateMechanicsEmbedding(game);
      results.push(embedding);
      console.log(`  ✓ MECHANICS generated`);
    } catch (error) {
      console.error(`  ✗ MECHANICS failed:`, error);
    }
  }

  // NARRATIVE
  if (targetFacets.includes("narrative") && canGenerateNarrativeEmbedding(game)) {
    try {
      const embedding = await generateNarrativeEmbedding(game);
      results.push(embedding);
      console.log(`  ✓ NARRATIVE generated`);
    } catch (error) {
      console.error(`  ✗ NARRATIVE failed:`, error);
    }
  }

  // ATMOSPHERE and DYNAMICS will be added in later phases

  console.log(`  Generated ${results.length}/${targetFacets.length} embeddings\n`);

  return results;
}

/**
 * Check which facets can be generated for a game
 */
export function getAvailableFacets(game: GameWithIgdb): FacetType[] {
  const available: FacetType[] = [];

  if (canGenerateAestheticEmbedding(game)) {
    available.push("aesthetic");
  }

  if (canGenerateMechanicsEmbedding(game)) {
    available.push("mechanics");
  }

  if (canGenerateNarrativeEmbedding(game)) {
    available.push("narrative");
  }

  return available;
}
