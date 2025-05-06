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
  fetchReviewData, // Import new function
  fetchPricingData, // Import new function
} from "@/lib/game-data"; // Import the moved functions

// Placeholder types (ideally import from game-data or types file if defined there)
import type {
  RapidApiReviewData,
  RapidApiPricingData,
} from "@/lib/rapidapi/types";

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

  // --- Fetch ALL Data Upfront ---
  // Fetch core game details
  const steamApiData = await fetchSteamDataFromApi(steamAppId);
  if (!steamApiData) {
    // Handle error: cannot proceed without core data
    console.error(
      `[Simple Find] Cannot generate report: Failed to fetch initial Steam API data for App ID ${steamAppId}.`
    );
    return new Response(
      JSON.stringify({ error: "Failed to fetch core game data from API." }),
      { status: 502 }
    );
  }

  // Fetch reviews and pricing (using placeholder functions for now)
  // Use Promise.all for concurrent fetching
  const [reviewData, pricingData] = await Promise.all([
    fetchReviewData(steamAppId),
    fetchPricingData(steamAppId),
  ]);

  console.log(
    `[Simple Find] Fetched review data (exists: ${!!reviewData}), pricing data (exists: ${!!pricingData})`
  );

  // --- Process Data & Generate Report ---

  // Create initial report from core data
  const partialReport = createPartialReportFromSteamApi(steamApiData);
  partialReport.sourceSteamUrl = primaryUrl;
  partialReport.steamAppId = steamAppId;

  // TODO: Add processing logic for reviewData and pricingData
  // Example: Extract review summary, pricing info, etc.
  // and potentially add them to the partialReport object if the schema supports it.
  // e.g., partialReport.reviewSummary = reviewData?.summary?.review_score_desc;
  // e.g., partialReport.price = pricingData?.price_overview?.final_price;

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

  // --- Generate Embedding (using richer data placeholder) ---
  console.log("[Simple Find] Attempting to generate embedding...");
  let embeddingVector: number[] | null = null;
  try {
    // Placeholder for processed review text
    let reviewSummaryText = "";
    if (reviewData?.summary?.review_score_desc) {
      reviewSummaryText += `Review Summary: ${reviewData.summary.review_score_desc}. `;
    }
    // Add more sophisticated review processing here - e.g., key phrases from reviews
    // const topReviewSnippets = reviewData?.reviews?.slice(0, 3).map(r => r.review_text).join(" ");
    // if (topReviewSnippets) reviewSummaryText += ` Top Reviews: ${topReviewSnippets}`;

    // Construct text for embedding - NOW includes placeholder for reviews
    const textToEmbed = [
      partialReport.gameName,
      partialReport.gameDescription,
      partialReport.developerName,
      partialReport.publisherName,
      Array.isArray(partialReport.genresAndTags)
        ? `Tags: ${partialReport.genresAndTags.join(", ")}`
        : null,
      reviewSummaryText.trim() || null, // Add processed review text if available
      // Potentially add pricing info if relevant? e.g., `Price: ${pricingData?.price_overview?.final_price}`
    ]
      .filter(Boolean)
      .join("\n\n");

    if (textToEmbed) {
      embeddingVector = await generateEmbedding(textToEmbed);
      console.log(
        `[Simple Find] Embedding generated successfully from text: "${textToEmbed.substring(
          0,
          100
        )}..."`
      );
    } else {
      console.warn(
        "[Simple Find] Could not generate embedding: No text content found after processing."
      );
    }
  } catch (embeddingError) {
    console.error(
      "[Simple Find] Failed to generate embedding:",
      embeddingError
    );
  }

  // --- Database Saving (including raw data) ---
  console.log(
    "[Simple Find] Attempting to save find to database (Update or Insert Steam)..."
  );
  let findId: number | null = null;
  try {
    const existingFind = await db
      .select({ id: dbSchema.finds.id })
      .from(dbSchema.finds)
      .where(eq(dbSchema.finds.sourceSteamAppId, steamAppId))
      .limit(1);

    // Construct data for saving, including raw JSON
    // **ASSUMES your schema has `rawReviewJson` and `rawPricingJson` columns of type JSONB**
    const findDataToSave = {
      sourceSteamUrl: primaryUrl,
      sourceSteamAppId: steamAppId,
      rawSteamJson: steamApiData,
      rawReviewJson: reviewData, // Save the raw review JSON
      rawPricingJson: pricingData, // Save the raw pricing JSON
      rawDemoHtml: null, // Not scraped in this version
      report: partialReport as DetailedIndieGameReport,
      vectorEmbedding: embeddingVector,
      updatedAt: new Date(),
      audienceAppeal: partialReport.audienceAppeal,
    };

    if (existingFind && existingFind.length > 0) {
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
      console.log(
        "[Simple Find] No existing find found. Inserting new record..."
      );
      const inserted = await db
        .insert(dbSchema.finds)
        .values({
          ...findDataToSave,
          createdAt: new Date(),
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

  // --- Return Response ---
  console.log(`[Simple Find] Responding with report for find ID: ${findId}`);
  return Response.json({
    // Return the enriched report if you added review/price fields to it,
    // otherwise, return the partialReport as before.
    report: partialReport as DetailedIndieGameReport,
    findId: findId,
    // Optionally include raw data in response for debugging?
    // rawReviewData: reviewData,
    // rawPricingData: pricingData,
  });
}
