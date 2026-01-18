/**
 * MECHANICS facet embedding generation
 *
 * Generates embeddings from game metadata that capture:
 * - Core gameplay mechanics
 * - Genre and subgenre
 * - Player perspective
 * - Game modes
 */

import { embedTextProjected, cleanTextForEmbedding } from "./text";
import {
  categorizeTags,
  extractSortedTags,
  inferPerspective,
  inferGameModes,
  inferSubgenre,
} from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

/**
 * Build structured text template for MECHANICS embedding
 *
 * Creates a structured representation of the game's mechanics
 * that can be embedded for similarity search.
 */
export function buildMechanicsText(game: GameWithIgdb): string {
  // Extract genres from raw Steam data
  const genres =
    game.raw?.genres?.map((g) => g.description).join(", ") || "Unknown";

  // Get and categorize tags
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);

  // Infer perspective and modes
  const perspective = inferPerspective(tags);
  const gameModes = inferGameModes(tags);
  const subgenre = inferSubgenre(tags);

  // Use IGDB data if available
  const igdbPerspectives =
    game.igdb_data?.player_perspectives?.join(", ") || perspective;
  const igdbModes = game.igdb_data?.game_modes?.join(", ") || gameModes.join(", ");
  const igdbKeywords = game.igdb_data?.keywords?.slice(0, 10).join(", ") || "";

  // Build template
  const parts: string[] = [
    `Genre: ${genres}`,
    `Perspective: ${igdbPerspectives}`,
    `Core mechanics: ${categorized.mechanics.slice(0, 8).join(", ") || "action"}`,
    `Game modes: ${igdbModes}`,
    `Subgenre: ${subgenre}`,
  ];

  // Add IGDB keywords if available
  if (igdbKeywords) {
    parts.push(`Keywords: ${igdbKeywords}`);
  }

  // Add any remaining mechanic-related tags
  if (categorized.other.length > 0) {
    parts.push(`Additional: ${categorized.other.slice(0, 5).join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Generate MECHANICS embedding for a game
 *
 * @param game - Game data with tags and optional IGDB enrichment
 * @returns Embedding input ready for storage
 */
export async function generateMechanicsEmbedding(
  game: GameWithIgdb
): Promise<EmbeddingInput> {
  const mechanicsText = buildMechanicsText(game);

  console.log(
    `Generating MECHANICS embedding for ${game.title}...`
  );
  console.log(`  Template:\n${mechanicsText.split("\n").map(l => `    ${l}`).join("\n")}`);

  const embedding = await embedTextProjected(mechanicsText);

  return {
    appid: game.appid,
    facet: "mechanics",
    embedding,
    source_type: "text",
    source_data: {
      template: mechanicsText,
      tags_used: extractSortedTags(game.steamspy_tags).slice(0, 15),
      has_igdb: !!game.igdb_data,
    },
    embedding_model: "text-embedding-3-small",
  };
}

/**
 * Check if a game has sufficient data for MECHANICS embedding
 */
export function canGenerateMechanicsEmbedding(game: GameWithIgdb): boolean {
  // We can always generate something, but quality depends on available tags
  const tags = extractSortedTags(game.steamspy_tags);
  return tags.length >= 1 || !!game.raw?.genres?.length;
}

/**
 * Get a preview of what the MECHANICS template would look like
 */
export function previewMechanicsTemplate(game: GameWithIgdb): string {
  return buildMechanicsText(game);
}
