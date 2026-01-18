/**
 * SigLIP image embedding via Replicate API
 *
 * Uses SigLIP 2 model for generating 768-dimensional image embeddings
 * that can be used for visual similarity search.
 */

import Replicate from "replicate";
import { TARGET_EMBEDDING_DIMENSIONS } from "./types";

// Initialize Replicate client (uses REPLICATE_API_TOKEN env var)
const replicate = new Replicate();

// Model configuration
const SIGLIP_MODEL = "lucataco/siglip:0c6c0a9ff7a872eb070820e8cac937a9cf2cd86d50a7455dec5a79ac26f41733";

/**
 * Generate an embedding for a single image URL using SigLIP
 *
 * @param imageUrl - URL of the image to embed
 * @returns 768-dimensional embedding vector
 */
export async function embedImage(imageUrl: string): Promise<number[]> {
  try {
    const output = await replicate.run(SIGLIP_MODEL, {
      input: {
        image: imageUrl,
      },
    });

    // The model returns an array of embeddings, we take the first one
    const embedding = Array.isArray(output) ? output[0] : output;

    if (!Array.isArray(embedding) || embedding.length !== TARGET_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding format: expected array of ${TARGET_EMBEDDING_DIMENSIONS}, got ${typeof embedding}`
      );
    }

    return embedding;
  } catch (error) {
    console.error(`Failed to embed image: ${imageUrl}`, error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple images in parallel
 *
 * @param imageUrls - Array of image URLs to embed
 * @param concurrency - Maximum concurrent requests (default: 3)
 * @returns Array of embeddings in the same order as input URLs
 */
export async function embedImages(
  imageUrls: string[],
  concurrency: number = 3
): Promise<number[][]> {
  const results: number[][] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(embedImage));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Compute weighted average of multiple embeddings
 *
 * @param embeddings - Array of embedding vectors
 * @param weights - Optional weights for each embedding (defaults to equal weights)
 * @returns Weighted average embedding
 */
export function weightedAverageEmbedding(
  embeddings: number[][],
  weights?: number[]
): number[] {
  if (embeddings.length === 0) {
    throw new Error("Cannot average empty embeddings array");
  }

  const dims = embeddings[0].length;

  // Default to equal weights
  const w = weights || embeddings.map(() => 1 / embeddings.length);

  // Normalize weights to sum to 1
  const totalWeight = w.reduce((a, b) => a + b, 0);
  const normalizedWeights = w.map((weight) => weight / totalWeight);

  // Compute weighted average
  const result = new Array(dims).fill(0);

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < dims; j++) {
      result[j] += embeddings[i][j] * normalizedWeights[i];
    }
  }

  return result;
}

/**
 * L2 normalize an embedding vector
 *
 * @param embedding - The embedding vector to normalize
 * @returns Normalized embedding with unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

  if (norm === 0) {
    return embedding;
  }

  return embedding.map((val) => val / norm);
}

/**
 * Compute cosine similarity between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Cosine similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Embed text using SigLIP's text encoder (for cross-modal search)
 *
 * Note: This requires a different model endpoint that supports text encoding.
 * For now, we'll use OpenAI for text and only use SigLIP for images.
 *
 * @param text - Text to embed
 * @returns 768-dimensional embedding vector
 */
export async function embedTextWithSiglip(text: string): Promise<number[]> {
  // TODO: Implement when we have a SigLIP text encoder endpoint
  // For now, throw an error to indicate this is not yet implemented
  throw new Error(
    "SigLIP text embedding not yet implemented. Use OpenAI text embedding instead."
  );
}
