import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
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
 * @param gameId The internal ID (games.id) of the game.
 * @returns Promise resolving when the operation is complete or throws on error.
 */
export async function generateEmbeddingForGame(gameId: number): Promise<void> {
  console.log(`[Embedding] Starting generation for game ID: ${gameId}`);

  try {
    // 1. Fetch game data
    const game = await db.query.gamesTable.findFirst({
      // Changed to gamesTable
      where: eq(schema.gamesTable.id, gameId), // Changed to gamesTable
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

    // 2. Check status - use appropriate statuses from gameOverallEnrichmentStatusEnum
    // Example: Allow if 'pending', 'partial', or 'failed' (if failed means retryable for embedding)
    if (
      game.enrichmentStatus !== "pending" &&
      game.enrichmentStatus !== "partial" &&
      game.enrichmentStatus !== "failed" // Or specific pre-embedding status
    ) {
      console.warn(
        `[Embedding] Skipping game ID ${gameId}: Status is '${game.enrichmentStatus}', not a processable state for embedding.`
      );
      return;
    }

    // Update status to processing
    await db
      .update(schema.gamesTable) // Changed to gamesTable
      .set({ enrichmentStatus: "in_progress" }) // Use valid enum value
      .where(eq(schema.gamesTable.id, gameId)) // Changed to gamesTable
      .execute();

    // 3. Concatenate text fields
    const inputText = [
      game.title,
      game.descriptionShort,
      game.descriptionDetailed,
      game.genres?.join(", "),
      game.tags?.join(", "),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!inputText.trim()) {
      console.warn(
        `[Embedding] Skipping game ID ${gameId}: No text content found to generate embedding.`
      );
      await db
        .update(schema.gamesTable) // Changed to gamesTable
        .set({ enrichmentStatus: "failed", embedding: null }) // Use valid enum value
        .where(eq(schema.gamesTable.id, gameId)) // Changed to gamesTable
        .execute();
      return;
    }

    console.log(
      `[Embedding] Generating embedding for game ID: ${gameId}, Title: ${game.title}`
    );

    // 4. Generate embedding
    const { embedding } = await embed({
      model: embeddingModel,
      value: inputText,
    });

    // 5. Update database
    await db
      .update(schema.gamesTable) // Changed to gamesTable
      .set({
        embedding: embedding,
        enrichmentStatus: "enriched", // Use valid enum value
      })
      .where(eq(schema.gamesTable.id, gameId)) // Changed to gamesTable
      .execute();

    console.log(
      `[Embedding] Successfully generated and saved embedding for game ID: ${gameId}`
    );
  } catch (error: any) {
    console.error(`[Embedding] Failed for game ID ${gameId}:`, error);
    // Optionally update DB status to 'embedding_failed'
    try {
      await db
        .update(schema.gamesTable) // Changed to gamesTable
        .set({ enrichmentStatus: "failed", embedding: null }) // Use valid enum value
        .where(eq(schema.gamesTable.id, gameId)) // Changed to gamesTable
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

// This function might be called by a scheduled job or a message queue worker
// For direct testing or a simple worker setup:
export async function generateEmbeddingForGameId(
  gameId: number
): Promise<void> {
  // This function is now a simple wrapper if generateEmbeddingForGame handles retries.
  // If generateEmbeddingForGame did not handle retries, this would be the place.
  // For now, just call the main function.
  await generateEmbeddingForGame(gameId);
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
