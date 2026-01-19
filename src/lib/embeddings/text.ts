import { embed } from "ai";
import { TARGET_EMBEDDING_DIMENSIONS } from "./types";

const TEXT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
  if (!text?.trim()) {
    throw new Error("Cannot embed empty text");
  }

  const { embedding } = await embed({
    model: TEXT_EMBEDDING_MODEL,
    value: text.trim(),
  });

  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}

export function projectDimensions(embedding: number[], targetDims = TARGET_EMBEDDING_DIMENSIONS): number[] {
  if (embedding.length === targetDims) return embedding;
  if (embedding.length < targetDims) return [...embedding, ...new Array(targetDims - embedding.length).fill(0)];
  return embedding.slice(0, targetDims);
}

export async function embedTextProjected(text: string, targetDims = TARGET_EMBEDDING_DIMENSIONS): Promise<number[]> {
  return projectDimensions(await embedText(text), targetDims);
}

export function cleanTextForEmbedding(text: string, maxLength = 8000): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
