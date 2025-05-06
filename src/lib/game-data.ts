"use strict";
// src/lib/game-data.ts

import type {
  RapidApiGameData,
  RapidApiExternalLink,
  RapidApiReviewsResponse,
  RapidApiReview,
} from "@/lib/rapidapi/types";
import type { DetailedIndieGameReport } from "@/schema";

const rapidApiKey = process.env.RAPIDAPI_KEY;

if (!rapidApiKey) {
  console.error("RAPIDAPI_KEY environment variable is not set.");
}

export async function fetchSteamDataFromApi(
  appId: string
): Promise<RapidApiGameData | null> {
  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured for Steam API call.");
    return null;
  }
  if (!appId || !/^[0-9]+$/.test(appId)) {
    console.error(`Invalid Steam App ID provided: ${appId}`);
    return null;
  }

  const url = `https://games-details.p.rapidapi.com/gameinfo/single_game/${appId}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": "games-details.p.rapidapi.com",
    },
  };

  console.log(`[Game Data] Fetching Steam data via API for App ID: ${appId}`);
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(`[Game Data] Steam API Error Body: ${errorBody}`);
      throw new Error(
        `[Game Data] RapidAPI (games-details) failed for App ID ${appId}: ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();
    if (result?.status !== 200 || !result?.data) {
      if (result?.data?.error) {
        console.warn(
          `[Game Data] Steam API returned error for App ID ${appId}: ${result.data.error}`
        );
        return null;
      }
      if (result?.data?.name === null && result?.data?.desc === null) {
        console.warn(
          `[Game Data] Steam API returned seemingly empty data for App ID ${appId}:`,
          result.data
        );
        return null;
      }
      console.warn(
        `[Game Data] Steam API returned non-success status or unexpected data structure for App ID ${appId}:`,
        result
      );
      return null;
    }
    console.log(
      `[Game Data] Successfully fetched Steam API data for App ID: ${appId}`
    );
    return result.data as RapidApiGameData;
  } catch (error) {
    console.error(
      `[Game Data] Error fetching Steam data for App ID ${appId} via API:`,
      error
    );
    return null;
  }
}

export function createPartialReportFromSteamApi(
  steamApiData: RapidApiGameData
): Partial<DetailedIndieGameReport> {
  const get = (obj: any, path: string, defaultValue: any = null) =>
    path.split(".").reduce((acc, part) => acc?.[part], obj) ?? defaultValue;

  const tags: string[] = get(steamApiData, "tags", []);

  const report: Partial<DetailedIndieGameReport> = {
    gameName: get(steamApiData, "name"),
    gameDescription: get(steamApiData, "desc"),
    developerName: get(steamApiData, "dev_details.developer_name.0"),
    publisherName: get(steamApiData, "dev_details.publisher.0"),
    releaseInfo: get(steamApiData, "release_date"),
    genresAndTags: tags,
    relevantLinks: [],
    audienceAppeal: null,
    overallReportSummary: null,
    aiConfidenceAssessment: "Report generated from Steam API data only.",
    fundingInfo: null,
    teamMembers: null,
    developerBackground: null,
    publisherInfo: null,
    sourceSteamUrl: null,
  };

  const linksToAdd: Array<{
    url: string | null;
    type: string;
    name: string | null;
  }> = [];

  const externalLinks: RapidApiExternalLink[] = get(
    steamApiData,
    "external_links",
    []
  );
  externalLinks.forEach((link) => {
    let type = "Other Link";
    const lowerCaseName = link.name.toLowerCase();
    const lowerCaseUrl = link.link.toLowerCase();

    if (lowerCaseName === "website" || lowerCaseUrl.includes("notion.site")) {
      type = "Official Website";
    } else if (lowerCaseName === "x" || lowerCaseUrl.includes("twitter.com")) {
      type = "Twitter Profile";
    } else if (
      lowerCaseName === "instagram" ||
      lowerCaseUrl.includes("instagram.com")
    ) {
      type = "Instagram";
    }

    linksToAdd.push({ url: link.link, type: type, name: link.name });
  });

  const screenshots: string[] = get(steamApiData, "media.screenshot", []);
  screenshots.forEach((url, index) => {
    linksToAdd.push({
      url: url,
      type: "Screenshot",
      name: `Screenshot ${index + 1}`,
    });
  });

  const videos: string[] = get(steamApiData, "media.videos", []);
  videos.forEach((url, index) => {
    linksToAdd.push({ url: url, type: "Video", name: `Video ${index + 1}` });
  });

  report.relevantLinks = linksToAdd;

  return report;
}

export async function fetchReviewData(
  appId: string,
  limit: number = 10
): Promise<RapidApiReview[] | null> {
  if (!rapidApiKey) {
    console.error(
      "[Game Data] RAPIDAPI_KEY not configured for review API call."
    );
    return null;
  }
  if (!appId || !/^[0-9]+$/.test(appId)) {
    console.error(
      `[Game Data] Invalid Steam App ID provided for reviews: ${appId}`
    );
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
    `[Game Data] Fetching recent Steam reviews via API for App ID: ${appId}`
  );
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(`[Game Data] Steam Reviews API Error Body: ${errorBody}`);
      console.error(
        `[Game Data] RapidAPI (games-details reviews) failed for App ID ${appId}: ${response.status} ${response.statusText}`
      );
      return null;
    }
    const result: RapidApiReviewsResponse = await response.json();
    if (
      result?.status !== 200 ||
      !result?.data?.reviews ||
      !Array.isArray(result.data.reviews)
    ) {
      console.warn(
        `[Game Data] Steam Reviews API returned non-success or malformed reviews data for App ID ${appId}:`,
        result
      );
      return null;
    }
    console.log(
      `[Game Data] Successfully fetched ${result.data.reviews.length} recent Steam reviews for App ID: ${appId}`
    );
    return result.data.reviews;
  } catch (error) {
    console.error(
      `[Game Data] Error fetching Steam reviews for App ID ${appId} via API:`,
      error
    );
    return null;
  }
}
