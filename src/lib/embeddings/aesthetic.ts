/**
 * AESTHETIC facet embedding generation
 *
 * Generates embeddings from game screenshots that capture:
 * - Art style (pixel art, hand-drawn, realistic, etc.)
 * - Color palette
 * - Visual density and complexity
 * - UI aesthetic
 */

import { embedImage, weightedAverageEmbedding, normalizeEmbedding } from "./siglip";
import type { GameForEmbedding, EmbeddingInput } from "./types";

// Configuration
const MAX_SCREENSHOTS = 4; // Header + 3 screenshots
const HEADER_WEIGHT = 0.4;
const SCREENSHOT_WEIGHT = 0.2;

/**
 * Generate AESTHETIC embedding for a game
 *
 * Uses header image and first few screenshots to create a visual embedding
 * that captures the game's art style and visual identity.
 *
 * @param game - Game data with images
 * @returns Embedding input ready for storage
 */
export async function generateAestheticEmbedding(
  game: GameForEmbedding
): Promise<EmbeddingInput> {
  // Collect image URLs
  const imageUrls: string[] = [];
  const weights: number[] = [];

  // Add header image (highest weight)
  if (game.header_image) {
    imageUrls.push(game.header_image);
    weights.push(HEADER_WEIGHT);
  }

  // Add screenshots (equal lower weights)
  const screenshotsToUse = game.screenshots.slice(0, MAX_SCREENSHOTS - 1);
  for (const screenshot of screenshotsToUse) {
    imageUrls.push(screenshot);
    weights.push(SCREENSHOT_WEIGHT);
  }

  if (imageUrls.length === 0) {
    throw new Error(`No images available for game ${game.appid}`);
  }

  // Generate embeddings for all images
  console.log(
    `Generating AESTHETIC embedding for ${game.title} using ${imageUrls.length} images...`
  );

  const embeddings: number[][] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const embedding = await embedImage(imageUrls[i]);
      embeddings.push(embedding);
    } catch (error) {
      console.warn(`Failed to embed image ${i + 1} for ${game.title}:`, error);
      // Remove the weight for this failed image
      weights.splice(embeddings.length, 1);
    }
  }

  if (embeddings.length === 0) {
    throw new Error(`Failed to embed any images for game ${game.appid}`);
  }

  // Compute weighted average
  const averaged = weightedAverageEmbedding(
    embeddings,
    weights.slice(0, embeddings.length)
  );

  // Normalize to unit length
  const normalized = normalizeEmbedding(averaged);

  return {
    appid: game.appid,
    facet: "aesthetic",
    embedding: normalized,
    source_type: "image",
    source_data: {
      image_urls: imageUrls.slice(0, embeddings.length),
      weights: weights.slice(0, embeddings.length),
      successful_embeds: embeddings.length,
    },
    embedding_model: "siglip2-base-patch16-224",
  };
}

/**
 * Check if a game has sufficient images for AESTHETIC embedding
 */
export function canGenerateAestheticEmbedding(game: GameForEmbedding): boolean {
  return !!(game.header_image || game.screenshots.length > 0);
}

/**
 * Get image URLs that would be used for AESTHETIC embedding
 */
export function getAestheticImageUrls(game: GameForEmbedding): string[] {
  const urls: string[] = [];

  if (game.header_image) {
    urls.push(game.header_image);
  }

  const screenshotsToUse = game.screenshots.slice(0, MAX_SCREENSHOTS - 1);
  urls.push(...screenshotsToUse);

  return urls;
}
