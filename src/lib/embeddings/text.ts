/**
 * Text embedding via OpenAI API
 *
 * Uses text-embedding-3-small for generating text embeddings
 * for mechanics, narrative, and other text-based facets.
 */

import { embed } from "ai";
import { TARGET_EMBEDDING_DIMENSIONS } from "./types";

const TEXT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generate an embedding for text using OpenAI
 *
 * @param text - Text to embed
 * @returns 1536-dimensional embedding vector
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot embed empty text");
  }

  const { embedding } = await embed({
    model: TEXT_EMBEDDING_MODEL,
    value: text.trim(),
  });

  return embedding;
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts - Array of texts to embed
 * @returns Array of embeddings in the same order as input texts
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Process sequentially to avoid rate limits
  // Could be parallelized with batching if needed
  const results: number[][] = [];

  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }

  return results;
}

/**
 * Project a high-dimensional embedding to lower dimensions
 *
 * Uses simple truncation/averaging - for production, consider PCA or learned projection
 *
 * @param embedding - Original embedding vector
 * @param targetDims - Target dimensions (default: 768 for SigLIP compatibility)
 * @returns Projected embedding
 */
export function projectDimensions(
  embedding: number[],
  targetDims: number = TARGET_EMBEDDING_DIMENSIONS
): number[] {
  if (embedding.length === targetDims) {
    return embedding;
  }

  if (embedding.length < targetDims) {
    // Pad with zeros (not ideal, but maintains compatibility)
    return [...embedding, ...new Array(targetDims - embedding.length).fill(0)];
  }

  // For reduction: use simple truncation
  // This preserves the first N dimensions which typically carry the most information
  // For better quality, implement PCA or a learned projection matrix
  return embedding.slice(0, targetDims);
}

/**
 * Generate a text embedding and project to target dimensions
 *
 * @param text - Text to embed
 * @param targetDims - Target dimensions (default: 768)
 * @returns Projected embedding
 */
export async function embedTextProjected(
  text: string,
  targetDims: number = TARGET_EMBEDDING_DIMENSIONS
): Promise<number[]> {
  const embedding = await embedText(text);
  return projectDimensions(embedding, targetDims);
}

/**
 * Clean and prepare text for embedding
 *
 * - Removes HTML tags
 * - Normalizes whitespace
 * - Truncates to max length
 *
 * @param text - Raw text to clean
 * @param maxLength - Maximum character length (default: 8000)
 * @returns Cleaned text
 */
export function cleanTextForEmbedding(
  text: string,
  maxLength: number = 8000
): string {
  return (
    text
      // Remove HTML tags
      .replace(/<[^>]*>/g, " ")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Trim
      .trim()
      // Truncate
      .slice(0, maxLength)
  );
}
