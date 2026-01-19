/**
 * ATMOSPHERE facet embedding generation
 *
 * Generates multimodal embeddings that capture:
 * - Emotional mood from screenshots
 * - Vibe/tone from tags and description
 */

import { embedImage, weightedAverageEmbedding, normalizeEmbedding } from "./siglip";
import { embedTextProjected } from "./text";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

// Match spec: 0.6 visual + 0.4 text (from 02-facet-model.md)
const IMAGE_WEIGHT = 0.6;
const TEXT_WEIGHT = 0.4;

/**
 * Build mood text from tags and description
 */
function buildMoodText(game: GameWithIgdb): string {
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);

  const parts: string[] = [];

  // Mood tags are most relevant
  if (categorized.moods.length > 0) {
    parts.push(`Mood: ${categorized.moods.slice(0, 5).join(", ")}`);
  }

  // Visual style contributes to atmosphere
  if (categorized.visuals.length > 0) {
    parts.push(`Style: ${categorized.visuals.slice(0, 3).join(", ")}`);
  }

  // Themes set the tone
  if (categorized.themes.length > 0) {
    parts.push(`Theme: ${categorized.themes.slice(0, 3).join(", ")}`);
  }

  // Extract mood words from description
  const desc = (game.short_description || "").toLowerCase();
  const moodWords: string[] = [];

  const moodPatterns = [
    { pattern: /dark|grim|bleak|sinister/i, mood: "dark" },
    { pattern: /cozy|warm|peaceful|relaxing/i, mood: "cozy" },
    { pattern: /tense|intense|thrilling|suspense/i, mood: "tense" },
    { pattern: /beautiful|gorgeous|stunning/i, mood: "beautiful" },
    { pattern: /eerie|creepy|haunting/i, mood: "eerie" },
    { pattern: /whimsical|charming|delightful/i, mood: "whimsical" },
    { pattern: /brutal|violent|visceral/i, mood: "brutal" },
    { pattern: /melancholic|sad|emotional/i, mood: "melancholic" },
  ];

  for (const { pattern, mood } of moodPatterns) {
    if (pattern.test(desc)) {
      moodWords.push(mood);
    }
  }

  if (moodWords.length > 0) {
    parts.push(`Feel: ${moodWords.join(", ")}`);
  }

  return parts.join("\n") || "atmospheric indie game";
}

/**
 * Generate ATMOSPHERE embedding for a game
 */
export async function generateAtmosphereEmbedding(
  game: GameWithIgdb
): Promise<EmbeddingInput> {
  console.log(`Generating ATMOSPHERE embedding for ${game.title}...`);

  const embeddings: number[][] = [];
  const weights: number[] = [];

  // Get image embedding from first screenshot or header
  const imageUrl = game.screenshots[0] || game.header_image;
  if (imageUrl) {
    try {
      const imageEmb = await embedImage(imageUrl);
      embeddings.push(imageEmb);
      weights.push(IMAGE_WEIGHT);
      console.log(`  Image embedding from screenshot`);
    } catch (error) {
      console.warn(`  Failed to embed image:`, error);
    }
  }

  // Get text embedding from mood data
  const moodText = buildMoodText(game);
  if (moodText) {
    try {
      const textEmb = await embedTextProjected(moodText);
      embeddings.push(textEmb);
      weights.push(TEXT_WEIGHT);
      console.log(`  Text embedding from mood: ${moodText.split("\n").join(", ")}`);
    } catch (error) {
      console.warn(`  Failed to embed mood text:`, error);
    }
  }

  if (embeddings.length === 0) {
    throw new Error(`No embeddings generated for atmosphere: ${game.appid}`);
  }

  const combined = weightedAverageEmbedding(embeddings, weights);
  const normalized = normalizeEmbedding(combined);

  return {
    appid: game.appid,
    facet: "atmosphere",
    embedding: normalized,
    source_type: "multimodal",
    source_data: {
      image_used: !!imageUrl,
      mood_text: moodText,
    },
    embedding_model: "siglip2+text-embedding-3-small",
  };
}

/**
 * Check if a game has sufficient data for ATMOSPHERE embedding
 */
export function canGenerateAtmosphereEmbedding(game: GameWithIgdb): boolean {
  // Need at least an image or some tags
  const hasImage = !!(game.header_image || game.screenshots.length > 0);
  const tags = extractSortedTags(game.steamspy_tags);
  const hasTags = tags.length > 0;

  return hasImage || hasTags;
}
