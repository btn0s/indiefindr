import path from "node:path";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { readSteamAppIdsFromCsv } from "@/lib/workers/csv-ingestion";
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment";
import { generateEmbeddingForGame } from "@/lib/workers/embedding-generation";
import { DrizzleGameRepository } from "@/lib/repositories/game-repository";

// Configuration
const CSV_FILE_PATH =
  process.env.CSV_SEED_FILE_PATH ||
  path.join(process.cwd(), "steam_appids_seed.csv");
const STEAM_API_DELAY_MS = 1500; // Delay between Steam API calls (1.5 seconds)

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(
    "Starting IndieFindr data ingestion process for a specific list of AppIDs..."
  );

  const specificAppIds = [
    "2744010",
    "3059070",
    "1966720",
    "1813860",
    "924750",
    "3350750",
    "2341070",
    "1269950",
    "219680",
    "916900",
    "1674780",
    "3562200",
    "2707300",
  ];

  let appIds: string[] = specificAppIds;
  console.log(`[Setup] Processing ${appIds.length} specific AppIDs.`);

  // --- Test Logic: Get steamAppid from the most recent game ---
  // try {
  //   const gameRepository = new DrizzleGameRepository();
  //   const recentGames = await gameRepository.getRecent(1);
  //   if (recentGames.length > 0 && recentGames[0].steamAppid) {
  //     const testAppId = recentGames[0].steamAppid;
  //     console.log(
  //       `[Test Setup] Found recent game. Using AppID: ${testAppId} for testing.`
  //     );
  //     appIds = [testAppId];
  //   } else {
  //     console.log(
  //       "[Test Setup] No recent games with a steamAppid found in the database. Falling back to CSV or exiting if CSV is empty."
  //     );
  //     // Fallback to CSV if no recent game found for testing, or handle as error for a focused test
  //     // For this specific test, if no recent game, we might want to stop to not process a full CSV.
  //     // However, the original script's CSV logic will run if appIds remains empty here.
  //   }
  // } catch (repoError) {
  //   console.error(
  //     "[Test Setup] Error fetching recent game for testing:",
  //     repoError
  //   );
  //   console.log("[Test Setup] Falling back to CSV or exiting if CSV is empty.");
  //   // Allow fallback to CSV logic below
  // }
  // --- End Test Logic ---

  // Original CSV reading logic (will be skipped if appIds got populated above)
  // if (appIds.length === 0) {
  //   try {
  //     console.log(`Attempting to read AppIDs from: ${CSV_FILE_PATH}`);
  //     appIds = await readSteamAppIdsFromCsv(CSV_FILE_PATH);
  //     if (appIds.length === 0) {
  //       console.log(
  //         "No AppIDs found in CSV and no recent game test ID. Exiting."
  //       );
  //       return;
  //     }
  //     console.log(`Found ${appIds.length} AppIDs from CSV to process.`);
  //   } catch (error) {
  //     console.error("Failed to read AppIDs from CSV:", error);
  //     process.exit(1);
  //   }
  // }

  if (appIds.length === 0) {
    console.log("No AppIDs to process. Exiting.");
    return;
  }

  for (const [index, appId] of appIds.entries()) {
    console.log(
      `\n--- Processing AppID ${appId} (${index + 1}/${appIds.length}) ---`
    );

    // 1. Enrich from Steam
    let gameInDb;
    try {
      console.log(`[Orchestration] Starting ingestion for AppID: ${appId}`);
      await enrichSteamAppId(appId);
      console.log(`[Orchestration] Enrichment successful for AppID: ${appId}`);

      // Fetch the game record to get its internal ID for embedding step
      gameInDb = await db.query.gamesTable.findFirst({
        where: eq(schema.gamesTable.externalId, appId),
        columns: { id: true, title: true, enrichmentStatus: true },
      });

      if (!gameInDb) {
        console.error(
          `[Orchestration] CRITICAL: Game ${appId} was supposedly enriched but not found in DB. Skipping embedding.`
        );
        continue; // Move to next AppID
      }
    } catch (error) {
      console.error(
        `[Orchestration] Enrichment failed for AppID ${appId}:`,
        (error as Error).message
      );
      console.log(
        `[Orchestration] Skipping embedding for AppID ${appId} due to enrichment failure.`
      );
      // enrichmentSteamAppId already updates status to 'enrichment_failed', so we just log and continue
      await delay(STEAM_API_DELAY_MS); // Still delay to be nice to API on next iteration
      continue; // Move to next AppID
    }

    // Add a delay before the next Steam API call in the loop
    if (index < appIds.length - 1) {
      console.log(
        `Delaying for ${STEAM_API_DELAY_MS / 1000}s before next Steam API call...`
      );
      await delay(STEAM_API_DELAY_MS);
    }

    // 2. Generate Embedding (if enrichment was successful and game exists)
    if (
      (gameInDb && gameInDb.enrichmentStatus === "partial") ||
      gameInDb.enrichmentStatus === "enriched" ||
      gameInDb.enrichmentStatus === "pending" ||
      gameInDb.enrichmentStatus === "failed"
    ) {
      try {
        console.log(
          `[Orchestration] Generating embedding for game: ${gameInDb.title} (DB ID: ${gameInDb.id})`
        );
        await generateEmbeddingForGame(gameInDb.id);
        console.log(
          `[Orchestration] Embedding generation successful for game: ${gameInDb.title}`
        );
      } catch (error) {
        console.error(
          `[Orchestration] Embedding generation failed for game ${gameInDb.title} (DB ID: ${gameInDb.id}):`,
          (error as Error).message
        );
        // generateEmbeddingForGame already updates status to 'embedding_failed', so just log
      }
    } else if (gameInDb) {
      console.log(
        `[Orchestration] Skipping embedding for game ${gameInDb.title} (DB ID: ${gameInDb.id}). Status: ${gameInDb.enrichmentStatus}`
      );
    }
  }

  console.log("\n--- IndieFindr data ingestion process finished. ---");
  process.exit(0);
}

main().catch((error) => {
  console.error(
    "An unexpected error occurred during the ingestion process:",
    error
  );
  process.exit(1);
});
