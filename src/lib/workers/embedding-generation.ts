import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateEmbeddings } from "ai";
import * as dotenv from "dotenv";

// Ensure env vars are loaded (especially OPENAI_API_KEY)
dotenv.config({ path: ".env.local" });

// Initialize OpenAI provider
// Assumes OPENAI_API_KEY is set in environment variables
const openai = createOpenAI({
  // apiKey: process.env.OPENAI_API_KEY, // apiKey is read from env automatically
  // compatibility: 'strict' // enforce openai compatibility
});

// Define the model to use
const embeddingModel = openai.embedding("text-embedding-3-small");

/**
 * Generates a semantic vector embedding for a game based on its text data
 * and updates the database record.
 *
 * @param gameId The internal ID (external_source.id) of the game.
 * @returns Promise resolving when the operation is complete or throws on error.
 */
export async function generateEmbeddingForGame(gameId: number): Promise<void> {
  console.log(`[Embedding] Starting generation for game ID: ${gameId}`);

  try {
    // 1. Fetch game data
    const game = await db.query.externalSourceTable.findFirst({
      where: eq(schema.externalSourceTable.id, gameId),
      columns: {
        title: true,
        descriptionShort: true,
        descriptionDetailed: true,
        genres: true,
        tags: true,
        enrichmentStatus: true,
      },
    });

    if (!game) {
      throw new Error(`Game with ID ${gameId} not found.`);
    }

    // 2. Check status
    if (game.enrichmentStatus !== "basic_info_extracted") {
      console.warn(
        `[Embedding] Skipping game ID ${gameId}: Status is '${game.enrichmentStatus}', not 'basic_info_extracted'.`
      );
      return; // Or throw, depending on desired behavior
    }

    // 3. Concatenate text fields
    // Simple concatenation strategy. Could be refined (e.g., adding labels like "Genres: ...")
    const inputText = [
      game.title,
      game.descriptionShort,
      game.descriptionDetailed,
      game.genres?.join(", "), // Join arrays into strings
      game.tags?.join(", "),
    ]
      .filter(Boolean)
      .join("\n\n"); // Join non-empty fields with double newline

    if (!inputText.trim()) {
      console.warn(
        `[Embedding] Skipping game ID ${gameId}: No text content found to generate embedding.`
      );
      await db
        .update(schema.externalSourceTable)
        .set({ enrichmentStatus: "embedding_failed", embedding: null })
        .where(eq(schema.externalSourceTable.id, gameId))
        .execute();
      return;
    }

    console.log(
      `[Embedding] Generating embedding for game ID: ${gameId}, Title: ${game.title}`
    );

    // 4. Generate embedding
    const { embedding } = await generateEmbeddings({
      model: embeddingModel,
      value: inputText,
    });

    // 5. Update database
    await db
      .update(schema.externalSourceTable)
      .set({
        embedding: embedding, // Drizzle custom vector type handles the array
        enrichmentStatus: "embedding_generated",
      })
      .where(eq(schema.externalSourceTable.id, gameId))
      .execute();

    console.log(
      `[Embedding] Successfully generated and saved embedding for game ID: ${gameId}`
    );
  } catch (error: any) {
    console.error(`[Embedding] Failed for game ID ${gameId}:`, error);
    // Optionally update DB status to 'embedding_failed'
    try {
      await db
        .update(schema.externalSourceTable)
        .set({ enrichmentStatus: "embedding_failed", embedding: null })
        .where(eq(schema.externalSourceTable.id, gameId))
        .execute();
    } catch (dbError) {
      console.error(
        `[Embedding] Failed to update status to failed for game ID ${gameId}:`,
        dbError
      );
    }
    // Re-throw the original error
    throw error;
  }
}

// Example usage placeholder
// async function main() {
//   // Assuming game with ID 1 exists and has status 'basic_info_extracted'
//   const testGameId = 1;
//   try {
//     await generateEmbeddingForGame(testGameId);
//     console.log(`Embedding process completed for game ${testGameId}.`);
//   } catch (error) {
//     console.error(`Embedding process failed for game ${testGameId}.`);
//   }
// }
// main();
