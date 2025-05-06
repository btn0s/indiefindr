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
  fetchReviewData, // Keep review fetch
  fetchPriceFromSearchApi, // Import the fallback function
} from "@/lib/game-data"; // Import the moved functions

// Import the specific Review type, Price is part of GameData now
import type {
  RapidApiReview,
  RapidApiPricing, // Import the specific pricing object type from game data
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
  // Fetch core game details (includes pricing)
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

  // Fetch reviews (pricing is now part of steamApiData)
  // Use Promise.all just for reviews (or add other concurrent fetches later)
  // const [reviewData] = await Promise.all([ // Simpler if only one promise
  //   fetchReviewData(steamAppId),
  // ]);
  // Let's fetch reviews directly
  const reviewData: RapidApiReview[] | null = await fetchReviewData(steamAppId);

  console.log(
    `[Simple Find] Fetched review data (count: ${reviewData?.length ?? 0})`
    // Pricing data is now within steamApiData
  );

  // --- Process Data & Generate Report ---

  // Create initial report from core data
  const partialReport = createPartialReportFromSteamApi(steamApiData);
  partialReport.sourceSteamUrl = primaryUrl;
  partialReport.steamAppId = steamAppId;

  // --- Process Review and Pricing Data ---
  // Process Reviews for Embedding Text
  let processedReviewText = "";
  const maxReviewsForEmbedding = 5; // How many review texts to include
  if (reviewData && reviewData.length > 0) {
    const reviewSnippets = reviewData
      .slice(0, maxReviewsForEmbedding)
      .map((review) => review.review_text?.trim()) // Get trimmed text
      .filter(Boolean); // Filter out empty reviews

    if (reviewSnippets.length > 0) {
      processedReviewText =
        "Recent Reviews:\n" + reviewSnippets.join("\n---\n"); // Join with a separator
    }
  }
  // Keep processedReviewSummary for potential display logic if needed, or remove
  // let processedReviewSummary = processedReviewText ? "Reviews available" : "No recent reviews available";

  // Process Pricing - with Fallback
  let processedPricingInfo = "";
  let foundPrimaryPrice = false;
  if (steamApiData?.pricing && steamApiData.pricing.length > 0) {
    const basePriceObj =
      steamApiData.pricing.find(
        (p) =>
          p.name.toLowerCase().startsWith("buy ") ||
          p.name.toLowerCase().startsWith("play ")
      ) || steamApiData.pricing[0];

    if (basePriceObj?.price.toLowerCase() === "free to play") {
      processedPricingInfo = "Free to Play";
      foundPrimaryPrice = true;
    } else if (basePriceObj?.price) {
      processedPricingInfo = `Price: ${basePriceObj.price}`;
      foundPrimaryPrice = true;
    }
  }

  // If primary pricing was empty or invalid, try the fallback
  if (!foundPrimaryPrice && partialReport.gameName) {
    console.log(
      `[Simple Find] Primary pricing not found for ${partialReport.gameName}, attempting fallback search...`
    );
    const fallbackPrice = await fetchPriceFromSearchApi(partialReport.gameName);

    if (fallbackPrice) {
      // Update display info
      processedPricingInfo = `Price: ${fallbackPrice}`;
      console.log(`[Simple Find] Found fallback price: ${fallbackPrice}`);

      // --- Splice fallback price into steamApiData ---
      if (steamApiData) {
        // Should always exist if we have partialReport.gameName
        if (!Array.isArray(steamApiData.pricing)) {
          console.warn(
            `[Simple Find] Initial steamApiData.pricing was not an array for ${partialReport.gameName}. Initializing.`
          );
          steamApiData.pricing = []; // Initialize if needed
        }
        // Add the fallback price as a new entry
        steamApiData.pricing.push({
          name: partialReport.gameName || "Base Game", // Use game name or a default
          price: fallbackPrice,
        });
        console.log(
          `[Simple Find] Spliced fallback price into steamApiData.pricing`
        );
      } else {
        console.error(
          `[Simple Find] Cannot splice fallback price: steamApiData is unexpectedly null/undefined.`
        );
      }
      // --- End Splicing ---
    } else {
      processedPricingInfo = "Price not available"; // Still N/A if fallback fails
      console.log(
        `[Simple Find] Fallback price search failed or yielded no result.`
      );
    }
  } else if (!foundPrimaryPrice) {
    processedPricingInfo = "Price not available";
  }
  // --- End Processing Logic ---

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

  // --- Generate Embedding (using processed data) ---
  console.log("[Simple Find] Attempting to generate embedding...");
  let embeddingVector: number[] | null = null;
  try {
    const textToEmbed = [
      partialReport.gameName,
      partialReport.gameDescription,
      `Developer: ${partialReport.developerName || "Unknown"}`,
      `Publisher: ${partialReport.publisherName || "Unknown"}`,
      Array.isArray(partialReport.genresAndTags)
        ? `Tags: ${partialReport.genresAndTags.join(", ")}`
        : null,
      // Use the concatenated review text if available
      processedReviewText || null,
      // Use pricing info if meaningful
      processedPricingInfo !== "Price not available"
        ? processedPricingInfo
        : null,
    ]
      .filter(Boolean) // Remove null/undefined/empty strings
      .join("\n\n"); // Join with double newline for separation

    if (textToEmbed) {
      embeddingVector = await generateEmbedding(textToEmbed);
      console.log(
        `[Simple Find] Embedding generated successfully from text: "${textToEmbed.substring(
          0,
          200 // Show more context including potential review start
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

  // --- Database Saving ---
  console.log(
    "[Simple Find] Attempting to save find to database (Update or Insert Steam)..."
  );
  let findId: number | null = null;
  try {
    // --- Pre-check required data ---
    if (!partialReport) {
      // Ensure report exists before DB ops
      throw new Error(
        "[Simple Find] Cannot save find: Processed report data is missing."
      );
    }

    const existingFind = await db
      .select({ id: dbSchema.finds.id })
      .from(dbSchema.finds)
      .where(eq(dbSchema.finds.sourceSteamAppId, steamAppId))
      .limit(1);

    // Base data object - guaranteed to have report now
    const baseFindData = {
      sourceSteamUrl: primaryUrl,
      sourceSteamAppId: steamAppId,
      rawSteamJson: steamApiData,
      rawReviewJson: reviewData,
      rawDemoHtml: null,
      report: partialReport as DetailedIndieGameReport, // Cast needed for $type
      vectorEmbedding: embeddingVector,
      audienceAppeal: partialReport.audienceAppeal,
    };

    // Filter out null/undefined optional values for update/insert cleanliness
    const optionalFieldsToClean = {
      sourceSteamUrl: baseFindData.sourceSteamUrl,
      sourceSteamAppId: baseFindData.sourceSteamAppId,
      rawSteamJson: baseFindData.rawSteamJson,
      rawReviewJson: baseFindData.rawReviewJson,
      rawDemoHtml: baseFindData.rawDemoHtml,
      vectorEmbedding: baseFindData.vectorEmbedding,
      audienceAppeal: baseFindData.audienceAppeal,
    };
    const cleanedOptionalFields = Object.fromEntries(
      Object.entries(optionalFieldsToClean).filter(
        ([_, v]) => v !== undefined && v !== null
      )
    );

    if (existingFind && existingFind.length > 0) {
      // --- Update Existing Find ---
      findId = existingFind[0].id;
      console.log(
        `[Simple Find] Found existing find with ID: ${findId}. Updating...`
      );
      await db
        .update(dbSchema.finds)
        .set({
          ...cleanedOptionalFields, // Spread cleaned optional fields
          report: baseFindData.report, // Explicitly include required report
          updatedAt: new Date(),
        })
        .where(eq(dbSchema.finds.sourceSteamAppId, steamAppId));
      console.log(`[Simple Find] Successfully updated find with ID: ${findId}`);
    } else {
      // --- Insert New Find ---
      console.log(
        "[Simple Find] No existing find found. Inserting new record..."
      );
      // Construct the final insert object, ensuring all required fields are present
      const finalInsertData: typeof dbSchema.finds.$inferInsert = {
        ...cleanedOptionalFields, // Spread cleaned optional fields
        report: baseFindData.report, // Explicitly include required report
        createdAt: new Date(),
        updatedAt: new Date(), // Also set updatedAt on insert (matches default behavior)
      };

      // // Previous validation check is no longer needed here as we check partialReport earlier
      // if (!finalInsertData.report) {
      //   throw new Error(
      //     "[Simple Find] Cannot insert find: Report data is missing."
      //   );
      // }

      const inserted = await db
        .insert(dbSchema.finds)
        .values(finalInsertData) // Pass the well-typed object
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
    report: partialReport as DetailedIndieGameReport,
    findId: findId,
    // rawReviewData: reviewData, // Optionally return for debugging
  });
}
