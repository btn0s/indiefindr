import Replicate from "replicate";
import { TARGET_EMBEDDING_DIMENSIONS } from "./types";

const replicate = new Replicate();
const SIGLIP_MODEL = "lucataco/siglip:0c6c0a9ff7a872eb070820e8cac937a9cf2cd86d50a7455dec5a79ac26f41733";

export async function embedImage(imageUrl: string): Promise<number[]> {
  try {
    const output = await replicate.run(SIGLIP_MODEL, { input: { image: imageUrl } });
    const embedding = Array.isArray(output) ? output[0] : output;

    if (!Array.isArray(embedding) || embedding.length !== TARGET_EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding format: expected array of ${TARGET_EMBEDDING_DIMENSIONS}, got ${typeof embedding}`);
    }

    return embedding;
  } catch (error) {
    console.error(`Failed to embed image: ${imageUrl}`, error);
    throw error;
  }
}

export async function embedImages(imageUrls: string[], concurrency = 3): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(embedImage)));
  }
  return results;
}

export function weightedAverageEmbedding(embeddings: number[][], weights?: number[]): number[] {
  if (embeddings.length === 0) {
    throw new Error("Cannot average empty embeddings array");
  }

  const dims = embeddings[0].length;
  const w = weights || embeddings.map(() => 1 / embeddings.length);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  const normalizedWeights = w.map((weight) => weight / totalWeight);

  const result = new Array(dims).fill(0);
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < dims; j++) {
      result[j] += embeddings[i][j] * normalizedWeights[i];
    }
  }

  return result;
}

export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return embedding;
  return embedding.map((val) => val / norm);
}

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
  return denominator === 0 ? 0 : dotProduct / denominator;
}
