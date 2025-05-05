"use strict";
// src/app/api/game-reviews/route.ts

import { type NextRequest, NextResponse } from "next/server";
import type {
  RapidApiReviewsResponse,
  RapidApiReview,
} from "@/lib/rapidapi/types";

export const maxDuration = 60; // Allow up to 60 seconds for API responses

const rapidApiKey = process.env.RAPIDAPI_KEY;

if (!rapidApiKey) {
  console.error(
    "RAPIDAPI_KEY environment variable is not set for game reviews."
  );
}

// --- Function to Fetch Steam Reviews ---
async function fetchSteamReviewsFromApi(
  appId: string,
  limit: number = 10 // Default limit
): Promise<RapidApiReview[] | null> {
  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured for Steam reviews API call.");
    return null;
  }
  if (!appId || !/^[0-9]+$/.test(appId)) {
    console.error(`Invalid Steam App ID provided for reviews: ${appId}`);
    return null;
  }

  const url = `https://games-details.p.rapidapi.com/reviews/mostrecent/${appId}?limit=${limit}&offset=0`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": "games-details.p.rapidapi.com",
    },
  };

  console.log(
    `[Game Reviews API] Fetching recent Steam reviews via API for App ID: ${appId}`
  );
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(
        `[Game Reviews API] Steam Reviews API Error Body: ${errorBody}`
      );
      throw new Error(
        `[Game Reviews API] RapidAPI (games-details reviews) failed for App ID ${appId}: ${response.status} ${response.statusText}`
      );
    }
    const result: RapidApiReviewsResponse = await response.json();
    if (
      result?.status !== 200 ||
      !result?.data?.reviews ||
      !Array.isArray(result.data.reviews)
    ) {
      console.warn(
        `[Game Reviews API] Steam Reviews API returned non-success or malformed reviews data for App ID ${appId}:`,
        result
      );
      return null; // Return null if reviews are not found or API error
    }
    console.log(
      `[Game Reviews API] Successfully fetched ${result.data.reviews.length} recent Steam reviews for App ID: ${appId}`
    );
    return result.data.reviews;
  } catch (error) {
    console.error(
      `[Game Reviews API] Error fetching Steam reviews for App ID ${appId} via API:`,
      error
    );
    return null; // Return null on fetch error
  }
}

// --- GET Handler ---
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get("appId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10; // Default to 10 if not specified or invalid

  if (!appId) {
    return NextResponse.json(
      { error: "Missing required parameter: appId" },
      { status: 400 }
    );
  }

  if (isNaN(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "Invalid limit parameter" },
      { status: 400 }
    );
  }

  try {
    const reviews = await fetchSteamReviewsFromApi(appId, limit);

    if (reviews === null) {
      // This could be due to API error, no reviews found, or invalid appId upstream
      // Distinguishing might require checking logs or the API response more closely if needed
      return NextResponse.json(
        { reviews: [] }, // Return empty array if reviews couldn't be fetched
        { status: 200 } // Or choose a different status like 404 if preferred when null
      );
    }

    return NextResponse.json({ reviews }, { status: 200 });
  } catch (error) {
    console.error("[Game Reviews API] Internal server error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching reviews" },
      { status: 500 }
    );
  }
}
