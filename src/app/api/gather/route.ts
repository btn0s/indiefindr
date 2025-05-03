import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { DetailedIndieGameReportSchema } from "@/schema";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const rapidApiKey = process.env.RAPIDAPI_KEY; // ADDED: RapidAPI Key

if (!rapidApiKey) {
  console.error("RAPIDAPI_KEY environment variable is not set.");
}

// ADDED: Type for raw tweet/author JSON + extracted text
interface RawTweetAndAuthorData {
  tweetText: string | null; // Keep extracted text for final schema
  tweetJson: object | null;
  authorJson: object | null;
}

// REVISED: Fetch raw JSON for tweet and author
async function fetchRawTweetAndAuthorJson(
  tweetId: string
): Promise<RawTweetAndAuthorData> {
  let tweetData: any = null;
  let userData: any = null;
  let tweetText: string | null = null;

  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured.");
    return { tweetText: null, tweetJson: null, authorJson: null };
  }

  // 1. Fetch Tweet Data
  const tweetUrl = `https://twitter241.p.rapidapi.com/tweet-v2?pid=${tweetId}`;
  const options = {
    // Renamed from tweetOptions for clarity
    method: "GET",
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": "twitter241.p.rapidapi.com",
    },
  };

  console.log(`Fetching raw tweet JSON for ID: ${tweetId}`);
  try {
    const tweetResponse = await fetch(tweetUrl, options);
    if (!tweetResponse.ok) {
      throw new Error(
        `RapidAPI (tweet-v2) failed for tweet ${tweetId}: ${tweetResponse.status} ${tweetResponse.statusText}`
      );
    }
    tweetData = await tweetResponse.json(); // Keep raw JSON
    // Also extract text needed for final schema
    tweetText = tweetData?.result?.tweetResult?.result?.legacy?.full_text;
    console.log(`Successfully fetched raw tweet JSON for ID: ${tweetId}`);

    // Extract User ID for next call
    const userId =
      tweetData?.result?.tweetResult?.result?.core?.user_results?.result
        ?.rest_id;

    if (userId) {
      console.log(
        `Found author User ID: ${userId}, fetching raw profile JSON...`
      );
      // ADDED: Wait 1 second to avoid rate limiting on the next API call
      console.log("Waiting 1 second before fetching user profile...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 2. Fetch User Data JSON if User ID found
      const userUrl = `https://twitter241.p.rapidapi.com/get-users?users=${userId}`;
      try {
        const userResponse = await fetch(userUrl, options); // Reuse options
        if (!userResponse.ok) {
          throw new Error(
            `RapidAPI (get-users) failed for user ${userId}: ${userResponse.status} ${userResponse.statusText}`
          );
        }
        userData = await userResponse.json(); // Keep raw JSON
        console.log(
          `Successfully fetched raw author profile JSON for User ID: ${userId}`
        );
      } catch (userError) {
        console.error(
          `Error fetching user profile JSON for ${userId} via RapidAPI:`,
          userError
        );
      }
    } else {
      console.warn(
        "Could not extract User ID from tweet data to fetch profile JSON."
      );
    }
  } catch (tweetError) {
    console.error(
      `Error fetching tweet JSON ${tweetId} via RapidAPI:`,
      tweetError
    );
    // Return nulls if tweet fetch fails
    return { tweetText: null, tweetJson: null, authorJson: null };
  }

  return { tweetText, tweetJson: tweetData, authorJson: userData };
}

// ADDED: Helper to find Steam URL in text or profile entities
function findSteamUrlInProfile(authorJson: any): string | null {
  if (!authorJson) return null;
  const profile = authorJson?.result?.data?.users?.[0]?.result?.legacy;
  if (!profile) return null;

  const steamUrlPattern =
    /https?:\/\/store\.steampowered\.com\/app\/\d+\/?[^\s]*/;

  // Check 1: Plain text in profile description
  if (profile.description) {
    const match = profile.description.match(steamUrlPattern);
    if (match && match[0]) {
      console.log(
        "Found Steam URL pattern in profile description text:",
        match[0]
      );
      return match[0];
    }
  }

  // Check 2: Entities within the description (parsed URLs)
  const descriptionUrls = profile.entities?.description?.urls;
  if (Array.isArray(descriptionUrls)) {
    for (const urlEntity of descriptionUrls) {
      if (urlEntity?.expanded_url) {
        const match = urlEntity.expanded_url.match(steamUrlPattern);
        if (match && match[0]) {
          console.log(
            "Found Steam URL in profile description entities:",
            match[0]
          );
          return match[0];
        }
      }
    }
  }

  // Check 3: Main profile URL field entity
  const profileUrlEntity = profile.entities?.url?.urls?.[0]?.expanded_url;
  if (profileUrlEntity) {
    const match = profileUrlEntity.match(steamUrlPattern);
    if (match && match[0]) {
      console.log("Found Steam URL in main profile URL field:", match[0]);
      return match[0];
    }
    // Potential Enhancement: Could follow the profileUrlEntity if it's a link shortener/hub like Linktree, but that adds complexity/fragility.
  }

  console.log("No Steam URL found directly in author profile JSON structure.");
  return null;
}

// ADDED: Function to fetch structured Steam data from RapidAPI
async function fetchSteamDataFromApi(appId: string): Promise<any | null> {
  // Return type 'any' for now, can be refined
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

  console.log(`Fetching Steam data via API for App ID: ${appId}`);
  try {
    // ADD delay if needed for this specific API endpoint's rate limit
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(url, options);
    if (!response.ok) {
      // Log API specific errors if possible
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(`Steam API Error Body: ${errorBody}`);
      throw new Error(
        `RapidAPI (games-details) failed for App ID ${appId}: ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();
    if (result?.status !== 200 || !result?.data) {
      console.warn(
        `Steam API returned non-success status or no data for App ID ${appId}:`,
        result
      );
      return null;
    }
    console.log(`Successfully fetched Steam API data for App ID: ${appId}`);
    return result.data; // Return the nested 'data' object
  } catch (error) {
    console.error(
      `Error fetching Steam data for App ID ${appId} via API:`,
      error
    );
    return null;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // 1. Extract Tweet URL and ID
  const tweetUrlPattern =
    /https?:\/\/(?:x|twitter)\.com\/[^\/]+\/status\/(\d+)/i;
  const match = userQuery.match(tweetUrlPattern);

  if (!match || !match[0] || !match[1]) {
    return new Response(
      JSON.stringify({
        error: "No valid Twitter/X status URL found in query.",
      }),
      { status: 400 }
    );
  }
  const primaryUrl = match[0]; // Full URL
  const tweetId = match[1]; // Extracted Tweet ID

  // 2. Fetch Raw Tweet and Author JSON data
  const { tweetText, tweetJson, authorJson } = await fetchRawTweetAndAuthorJson(
    tweetId
  );

  if (!tweetText) {
    return new Response(
      JSON.stringify({
        error: `Failed to fetch tweet text content for ${primaryUrl}`,
      }),
      { status: 500 }
    );
  }

  // 3. Attempt to find Steam App ID directly from Author JSON
  console.log("Attempting to find Steam App ID in author profile...");
  let steamAppId: string | null = null;
  const steamUrlPattern = /store\.steampowered\.com\/app\/(\d+)/;
  if (authorJson) {
    // Check description entities first (most reliable)
    const descriptionUrls = (authorJson as any)?.result?.data?.users?.[0]
      ?.result?.legacy?.entities?.description?.urls;
    if (Array.isArray(descriptionUrls)) {
      for (const urlEntity of descriptionUrls) {
        const match = urlEntity?.expanded_url?.match(steamUrlPattern);
        if (match && match[1]) {
          steamAppId = match[1];
          console.log(
            `Found Steam App ID ${steamAppId} in description entities.`
          );
          break;
        }
      }
    }
    // Check description text as fallback
    if (!steamAppId) {
      const descText = (authorJson as any)?.result?.data?.users?.[0]?.result
        ?.legacy?.description;
      if (descText) {
        const match = descText.match(steamUrlPattern);
        if (match && match[1]) {
          steamAppId = match[1];
          console.log(`Found Steam App ID ${steamAppId} in description text.`);
        }
      }
    }
    // Check main profile URL field as another fallback
    if (!steamAppId) {
      const profileUrlEntity = (authorJson as any)?.result?.data?.users?.[0]
        ?.result?.legacy?.entities?.url?.urls?.[0]?.expanded_url;
      if (profileUrlEntity) {
        const match = profileUrlEntity.match(steamUrlPattern);
        if (match && match[1]) {
          steamAppId = match[1];
          console.log(`Found Steam App ID ${steamAppId} in profile URL field.`);
        }
      }
    }
  }

  if (!steamAppId) {
    console.log("No Steam App ID found in author profile.");
  }

  // 4. Fetch Steam API Data if App ID was found
  let steamApiData: any | null = null;
  if (steamAppId) {
    console.log(`Fetching Steam API data for App ID: ${steamAppId}`);
    steamApiData = await fetchSteamDataFromApi(steamAppId);
    if (!steamApiData) {
      console.warn(
        `Failed to fetch Steam API data for App ID ${steamAppId}. Proceeding without it.`
      );
    }
  }

  // 5. Final Synthesis (No Web Search, Direct JSON Analysis)
  console.log("Preparing for final synthesis using available JSON data...");
  let finalSynthesisPrompt = `Analyze the following raw API data for a Twitter tweet, the tweet author's profile, and potentially Steam game details. Your goal is to extract and synthesize this information into a comprehensive, factual report strictly conforming to the DetailedIndieGameReportSchema JSON format. Web search was NOT performed.\n\n**Sources Provided:**\n\nSource 1: Original Tweet Text (for 'sourceTweetText' field and context):\n---\n${tweetText}\n---\n\nSource 2: Tweet JSON Data:\n\`\`\`json\n${
    JSON.stringify(tweetJson, null, 2) || "Not available"
  }\n\`\`\`\n\nSource 3: Author Profile JSON Data:\n\`\`\`json\n${
    JSON.stringify(authorJson, null, 2) || "Not available"
  }\n\`\`\`\n`;

  if (steamApiData) {
    finalSynthesisPrompt += `\nSource 4: Steam Game Details JSON Data (Derived from link in Author Profile):\n\`\`\`json\n${
      JSON.stringify(steamApiData, null, 2) || "Not available"
    }\n\`\`\`\n`;
  }

  finalSynthesisPrompt += `\n**Instructions:**\n1.  Analyze all provided JSON sources (Tweet, Author, Steam if available).\n2.  Identify the primary game, developer, and publisher (if possible) based on the data (prioritize Author JSON name/bio/hashtags and Steam JSON data if present).\n3.  Extract relevant details like descriptions, background info, team members, funding, release status, platforms, genres/tags, website links, social links, community links, store links, etc., directly from the JSON data.\n4.  Populate the 'relevantLinks' array by finding all URLs within the JSON sources and categorizing their 'type' accurately (e.g., 'Steam', 'Twitter Profile', 'Official Website', 'Linktree', 'Other Social').\n5.  Populate the JSON object strictly conforming to DetailedIndieGameReportSchema.\n6.  Provide a confidence level in 'aiConfidenceAssessment', noting that web search was skipped and confidence depends on the richness of the provided JSON data.\n7.  Write a concise 'overallReportSummary'.\n8.  Use 'null' for fields where no information could be extracted from the provided JSON sources.\n\nGenerate *only* the final JSON object conforming to DetailedIndieGameReportSchema.`;

  console.log("Performing final AI synthesis directly from API JSON data...");
  const finalResult = await generateObject({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
    schema: DetailedIndieGameReportSchema,
  });

  // 6. Return the final object
  return Response.json(finalResult.object);
}
