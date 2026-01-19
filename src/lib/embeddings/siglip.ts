import Replicate from "replicate";
import { TARGET_EMBEDDING_DIMENSIONS } from "./types";

const CLIP_MODEL = "krthr/clip-embeddings:1c0371070cb827ec3c7f2f28adcdde54b50dcd239aa6faea0bc98b174ef03fb4";

let _replicate: Replicate | null = null;
function getReplicate(): Replicate {
  if (!_replicate) {
    _replicate = new Replicate();
  }
  return _replicate;
}

export async function embedImage(imageUrl: string): Promise<number[]> {
  try {
    const output = await getReplicate().run(CLIP_MODEL, { input: { image: imageUrl } }) as { embedding: number[] };

    if (!output?.embedding || !Array.isArray(output.embedding)) {
      throw new Error(`Unexpected embedding format: expected {embedding: number[]}, got ${typeof output}`);
    }

    if (output.embedding.length !== TARGET_EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding dimensions: expected ${TARGET_EMBEDDING_DIMENSIONS}, got ${output.embedding.length}`);
    }

    return output.embedding;
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
