"use strict";
// src/app/api/find/route.ts

import { db, schema as dbSchema } from "@/db";
import { eq } from "drizzle-orm";
import {
  DetailedIndieGameReportSchema, // Keep for type validation if needed, though not strictly used by AI here
  type DetailedIndieGameReport,
} from "@/schema";
import { extractSteamAppId } from "@/lib/utils";
import { generateEmbedding } from "@/lib/embeddings"; // Import the embedding function
import { openai } from "@ai-sdk/openai"; // Import AI SDK OpenAI provider
import { generateText } from "ai"; // Import generateText
import {
  fetchSteamDataFromApi,
  createPartialReportFromSteamApi,
} from "@/lib/game-data"; // Import the moved functions

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Remove RapidAPI key definition if fetch function handles it
// const rapidApiKey = process.env.RAPIDAPI_KEY;
// if (!rapidApiKey) {
//   console.error("RAPIDAPI_KEY environment variable is not set.");
// }

// --- Core Functions are now imported from @/lib/game-data ---
// ... fetchSteamDataFromApi removed ...
// ... createPartialReportFromSteamApi removed ...

// --- Simplified POST Handler ---

export async function POST(req: Request) {
  // Expect a JSON body with { steam_link: "url" }
  const body = await req.json();
  const primaryUrl = body.steam_link;

  if (!primaryUrl || typeof primaryUrl !== "string") {
    console.error(
      '[Simple Find] Invalid request body. Expected { steam_link: "url" }',
      body
    );
    return new Response(
      JSON.stringify({
        error: 'Invalid request body. Expected { steam_link: "url" }. ',
      }),
      { status: 400 }
    );
  }

  // 1. Validate input as a Steam URL and Extract App ID
  console.log(`[Simple Find] Validating Steam URL from request: ${primaryUrl}`);
  const steamAppId = extractSteamAppId(primaryUrl);

  if (!steamAppId) {
    console.error(
      "[Simple Find] Invalid input: Not a valid Steam App URL.",
      primaryUrl
    );
    return new Response(
      JSON.stringify({
        error:
          "Invalid input. Please provide a valid Steam App URL (e.g., store.steampowered.com/app/...).",
      }),
      { status: 400 }
    );
  }

  console.log(
    `[Simple Find] Processing Steam URL: ${primaryUrl}, App ID: ${steamAppId}`
  );

  // 2. Fetch Steam API Data (using imported function)
  const steamApiData = await fetchSteamDataFromApi(steamAppId); // Use imported function

  if (!steamApiData) {
    console.error(
      `[Simple Find] Cannot generate report: Failed to fetch initial Steam API data for App ID ${steamAppId}.`
    );
    return new Response(
      JSON.stringify({ error: "Failed to fetch game data from Steam API." }),
      { status: 502 } // Bad Gateway or appropriate error
    );
  }

  // 3. Create Partial Report from API Data (using imported function)
  const partialReport = createPartialReportFromSteamApi(steamApiData); // Use imported function
  // Add the source URL and Steam App ID to the report
  partialReport.sourceSteamUrl = primaryUrl;
  partialReport.steamAppId = steamAppId;

  // --- Generate Audience Appeal using AI SDK ---
  console.log("[Simple Find] Attempting to generate audience appeal via AI...");
  try {
    const textToAnalyze = `Game Name: ${partialReport.gameName || "Unknown"}
Description: ${partialReport.gameDescription || "No description available."}
Tags: ${partialReport.genresAndTags?.join(", ") || "No tags"}`;

    const { text: audienceAppealText } = await generateText({
      model: openai("gpt-4o-mini"), // Or your preferred model
      system:
        "You are an assistant writing for a website about indie games. Your goal is to help players discover if they might like a game based on its description, tags, and potential mechanics.",
      prompt: `Based on the following game details, write a short, engaging \"You'll like this game if...\" statement (1-2 sentences max). ALWAYS start the response with a phrase like \"If you like...\", \"If you enjoy...\", \"If you love...\", etc. Be specific about the potential player experience, genre, themes, and especially any inferred or stated game mechanics based on the description and tags. 

Details:
${textToAnalyze}`,
      maxTokens: 100,
    });

    partialReport.audienceAppeal = audienceAppealText.trim();
    console.log(
      "[Simple Find] Audience appeal generated successfully:",
      partialReport.audienceAppeal
    );
  } catch (aiError) {
    console.error(
      "[Simple Find] Failed to generate audience appeal via AI:",
      aiError
    );
    // Fallback or leave as null - currently leaves as null
    // You could add the rule-based logic here as a fallback if desired
  }
  // --- End Generate Audience Appeal ---

  // 4. Generate Embedding
  console.log("[Simple Find] Attempting to generate embedding...");
  let embeddingVector: number[] | null = null;
  try {
    // Construct text for embedding (combine key fields from the partial report)
    const textToEmbed = [
      partialReport.gameName,
      partialReport.gameDescription,
      partialReport.developerName,
      partialReport.publisherName,
      Array.isArray(partialReport.genresAndTags)
        ? partialReport.genresAndTags.join(", ")
        : null,
    ]
      .filter(Boolean) // Remove null/undefined/empty strings
      .join("\n\n"); // Join with double newline for separation

    if (textToEmbed) {
      embeddingVector = await generateEmbedding(textToEmbed);
      console.log("[Simple Find] Embedding generated successfully.");
    } else {
      console.warn(
        "[Simple Find] Could not generate embedding: No text content found in partial report."
      );
    }
  } catch (embeddingError) {
    console.error(
      "[Simple Find] Failed to generate embedding:",
      embeddingError
    );
    // Decide if you want to fail the whole process or just log and continue
    // For now, we log and continue, saving the find without an embedding.
  }

  // 5. Database Saving
  console.log(
    "[Simple Find] Attempting to save find to database (Update or Insert Steam)..."
  );
  let findId: number | null = null;
  try {
    // Check for existing find using Steam App ID
    const existingFind = await db
      .select({ id: dbSchema.finds.id })
      .from(dbSchema.finds)
      .where(eq(dbSchema.finds.sourceSteamAppId, steamAppId))
      .limit(1);

    // Construct data for saving
    // Ensure the structure matches your db schema, setting unused fields to null
    const findDataToSave = {
      sourceSteamUrl: primaryUrl,
      sourceSteamAppId: steamAppId,
      rawSteamJson: steamApiData, // Still save the raw data fetched
      rawDemoHtml: null, // Not scraped in this version
      report: partialReport as DetailedIndieGameReport,
      vectorEmbedding: embeddingVector, // Use the generated embedding vector
      updatedAt: new Date(),
      audienceAppeal: partialReport.audienceAppeal, // Ensure it's included here
    };

    if (existingFind && existingFind.length > 0) {
      // Update existing find based on steamAppId
      findId = existingFind[0].id;
      console.log(
        `[Simple Find] Found existing find with ID: ${findId}. Updating...`
      );
      await db
        .update(dbSchema.finds)
        .set(findDataToSave)
        .where(eq(dbSchema.finds.sourceSteamAppId, steamAppId));
      console.log(`[Simple Find] Successfully updated find with ID: ${findId}`);
    } else {
      // Insert new find
      console.log(
        "[Simple Find] No existing find found. Inserting new record..."
      );
      const inserted = await db
        .insert(dbSchema.finds)
        .values({
          ...findDataToSave,
          createdAt: new Date(), // Add createdAt on insert
        })
        .returning({ id: dbSchema.finds.id });

      if (inserted && inserted.length > 0 && inserted[0].id) {
        findId = inserted[0].id;
        console.log(
          `[Simple Find] Successfully saved new find to database with ID: ${findId}`
        );
      } else {
        console.error(
          "[Simple Find] Insert command succeeded but did not return a new ID."
        );
        throw new Error(
          "[Simple Find] Failed to retrieve ID after inserting new find."
        );
      }
    }
  } catch (error) {
    console.error("[Simple Find] Error during database operation:", error);
    return new Response(
      JSON.stringify({
        error:
          "[Simple Find] Failed to save the analysis result to the database.",
      }),
      { status: 500 }
    );
  }

  // 6. Return the partial report object AND the find ID
  console.log(`[Simple Find] Responding with report for find ID: ${findId}`);
  // Ensure partialReport is cast or fits the expected return structure
  return Response.json({
    report: partialReport as DetailedIndieGameReport,
    findId: findId,
  });
}
