import { db, schema } from "../src/db";
import { isNotNull, sql } from "drizzle-orm";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// --- Configuration ---
const API_ENDPOINT = "http://localhost:3000/api/find"; // Your local API endpoint
const CONCURRENCY = 5; // Number of requests to send in parallel
const DELAY_MS = 200; // Delay between batches (in milliseconds)
// ---------------------

interface FindResult {
  id: number;
  sourceSteamUrl: string | null;
}

async function postToFindApi(
  steamUrl: string,
  findId: number
): Promise<boolean> {
  console.log(`[Re-Embed] Processing ID: ${findId} - URL: ${steamUrl}`);
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steam_link: steamUrl }),
    });

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(
        `[Re-Embed] Failed for ID: ${findId}. Status: ${response.status}. Body: ${errorBody}`
      );
      return false;
    }

    const result = await response.json();
    console.log(
      `[Re-Embed] Success for ID: ${findId}. API Response: ${JSON.stringify(
        result
      )}`
    );
    return true;
  } catch (error) {
    console.error(
      `[Re-Embed] Network/Fetch Error for ID: ${findId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function processBatch(batch: FindResult[]) {
  const promises = batch.map((find) => {
    if (find.sourceSteamUrl) {
      return postToFindApi(find.sourceSteamUrl, find.id);
    }
    return Promise.resolve(true); // Skip if no URL
  });
  await Promise.all(promises);
}

async function runReEmbed() {
  console.log("[Re-Embed] Starting script...");
  try {
    console.log("[Re-Embed] Fetching finds with Steam URLs from database...");
    const findsToProcess: FindResult[] = await db
      .select({
        id: schema.finds.id,
        sourceSteamUrl: schema.finds.sourceSteamUrl,
      })
      .from(schema.finds)
      .where(isNotNull(schema.finds.sourceSteamUrl));
    // Add orderBy if needed: .orderBy(schema.finds.id)

    console.log(
      `[Re-Embed] Found ${findsToProcess.length} records to process.`
    );

    if (findsToProcess.length === 0) {
      console.log("[Re-Embed] No records found with Steam URLs. Exiting.");
      return;
    }

    console.log(
      `[Re-Embed] Processing in batches of ${CONCURRENCY} with ${DELAY_MS}ms delay...`
    );

    for (let i = 0; i < findsToProcess.length; i += CONCURRENCY) {
      const batch = findsToProcess.slice(i, i + CONCURRENCY);
      console.log(`[Re-Embed] Processing batch ${i / CONCURRENCY + 1}...`);
      await processBatch(batch);

      if (i + CONCURRENCY < findsToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log("[Re-Embed] Finished processing all batches.");
  } catch (error) {
    console.error("[Re-Embed] An error occurred during the process:", error);
    process.exitCode = 1;
  } finally {
    // Ensure the script exits. Drizzle with postgres-js might keep connection open.
    // We don't explicitly have the client here, but Node should exit.
    // If it hangs, we might need to explicitly get and end the postgres client.
    console.log("[Re-Embed] Script finished.");
    process.exit(0);
  }
}

runReEmbed();
