import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

// Ensure your OpenAI API key is configured in your environment variables
// (e.g., OPENAI_API_KEY)

const EMBEDDING_MODEL_NAME = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536; // Dimensions for text-embedding-3-small

/**
 * Generates an embedding vector for the given text using OpenAI's API.
 * @param text The text content to embed.
 * @returns A promise that resolves to an array of numbers (the embedding vector).
 * @throws An error if the embedding generation fails.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL_NAME, {
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      value: text,
    });
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(
      `Failed to generate embedding: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Optional: Add functions for batch embedding if needed later
