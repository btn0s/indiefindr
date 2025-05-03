import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import scrapingbee from "scrapingbee";
import * as cheerio from "cheerio";
import { DetailedIndieGameReportSchema } from "@/schema";

// example string for LLM testing
// const testString = "https://x.com/Just_Game_Dev/status/1918036677609521466";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const rapidApiKey = process.env.RAPIDAPI_KEY;
const scrapingBeeApiKey = process.env.SCRAPINGBEE_API_KEY;

if (!rapidApiKey) {
  console.error("RAPIDAPI_KEY environment variable is not set.");
}
if (!scrapingBeeApiKey) {
  console.error("SCRAPINGBEE_API_KEY environment variable is not set.");
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

// RE-ADD ScrapingBee client creator
async function createScrapingBeeClient() {
  if (!scrapingBeeApiKey) {
    console.error("Attempted to create ScrapingBee client without an API key.");
    return null;
  }
  return new scrapingbee.ScrapingBeeClient(scrapingBeeApiKey);
}

// UPDATED: Function to scrape raw HTML of the Steam demo section using Cheerio
async function scrapeSteamDemoSectionHtml(
  steamUrl: string | null
): Promise<string | null> {
  if (!steamUrl) return null;
  const client = await createScrapingBeeClient();
  if (!client) return null;

  console.log(`Scraping Steam page for demo section HTML: ${steamUrl}`);

  try {
    const response = await client.get({
      url: steamUrl,
      params: {
        render_js: false,
        block_resources: true,
        country_code: "US",
      },
      headers: {
        // Optional: Set headers if needed, e.g., Accept-Language
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `ScrapingBee failed for Steam demo check ${steamUrl}: ${response.status} ${response.statusText}`
      );
    }

    const decoder = new TextDecoder();
    const html = decoder.decode(response.data);

    // Use Cheerio to find the div and extract its inner HTML
    const $ = cheerio.load(html);
    const demoDiv = $("div.game_area_purchase_game.demo_above_purchase");

    if (demoDiv.length > 0) {
      // Get the inner HTML of the first matching element
      const demoHtml = demoDiv.html();
      if (demoHtml) {
        console.log("Found demo section HTML snippet using Cheerio.");
        return demoHtml.trim();
      } else {
        console.log("Demo section div found, but it was empty.");
        return null;
      }
    } else {
      console.log(
        "Demo section div not found on Steam page using Cheerio selector."
      );
      return null;
    }
  } catch (error) {
    console.error(
      `Error scraping Steam page ${steamUrl} for demo section:`,
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

  // 3. Attempt to find Steam App ID AND URL directly from Author JSON
  console.log("Attempting to find Steam App ID and URL in author profile...");
  let steamAppId: string | null = null;
  let profileSteamUrl: string | null = null; // Store the found URL
  const steamUrlPattern =
    /(https?:\/\/store\.steampowered\.com\/app\/(\d+)\/?[^\s]*)/i; // Capture group 1 is full URL, group 2 is AppID

  if (authorJson) {
    try {
      // Check description entities first
      const descriptionUrls = (authorJson as any)?.result?.data?.users?.[0]
        ?.result?.legacy?.entities?.description?.urls;
      if (Array.isArray(descriptionUrls)) {
        for (const urlEntity of descriptionUrls) {
          const match = urlEntity?.expanded_url?.match(steamUrlPattern);
          if (match && match[1] && match[2]) {
            profileSteamUrl = match[1]; // Store the full URL
            steamAppId = match[2]; // Store the App ID
            console.log(
              `Found Steam URL ${profileSteamUrl} (App ID ${steamAppId}) in description entities.`
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
          if (match && match[1] && match[2]) {
            profileSteamUrl = match[1];
            steamAppId = match[2];
            console.log(
              `Found Steam URL ${profileSteamUrl} (App ID ${steamAppId}) in description text.`
            );
          }
        }
      }
      // Check main profile URL field as another fallback
      if (!steamAppId) {
        const profileUrlEntity = (authorJson as any)?.result?.data?.users?.[0]
          ?.result?.legacy?.entities?.url?.urls?.[0]?.expanded_url;
        if (profileUrlEntity) {
          const match = profileUrlEntity.match(steamUrlPattern);
          if (match && match[1] && match[2]) {
            profileSteamUrl = match[1];
            steamAppId = match[2];
            console.log(
              `Found Steam URL ${profileSteamUrl} (App ID ${steamAppId}) in profile URL field.`
            );
          }
        }
      }
    } catch (e) {
      console.error("Error accessing properties in authorJson:", e);
    }
  }

  if (!steamAppId) {
    console.log("No Steam App ID found in author profile.");
  }

  // 4. Fetch Steam API Data AND Scrape Demo HTML if App ID was found
  let steamApiData: any | null = null;
  let rawDemoHtml: string | null = null;

  if (steamAppId) {
    console.log(`Fetching Steam API data for App ID: ${steamAppId}`);
    steamApiData = await fetchSteamDataFromApi(steamAppId);
    if (steamApiData) {
      // Scrape the ORIGINAL profileSteamUrl for the demo section
      console.log(
        `Scraping verified Steam URL for demo section: ${profileSteamUrl}`
      );
      rawDemoHtml = await scrapeSteamDemoSectionHtml(profileSteamUrl); // Pass the original URL
    } else {
      console.warn(
        `Failed to fetch Steam API data for App ID ${steamAppId}. Proceeding without it (and without demo check).`
      );
    }
  }

  // 5. Final Synthesis (No Web Search, Direct JSON Analysis + Raw Demo HTML)
  console.log(
    "Preparing for final synthesis using available data (incl. demo HTML check)..."
  );
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

  if (rawDemoHtml) {
    finalSynthesisPrompt += `\nSource 5: Raw HTML Snippet of Steam Page Demo Section:\n\`\`\`html\n${rawDemoHtml}\n\`\`\`\n`;
  }

  finalSynthesisPrompt += `\n**Instructions:**\n1.  Analyze all provided sources (Tweet, Author JSON, Steam API JSON, Raw Demo HTML Snippet).\n2.  **Strict Field Mapping:** Populate fields *only* with information that accurately matches the field's description based on the sources. Do **not** substitute information (e.g., do not put a Steam link in a field meant for an official website if the official website URL is not found).\n3.  Identify the primary game, developer, and publisher (if possible) based on the data (prioritize Author JSON name/bio/hashtags and Steam JSON data if present).\n4.  Extract relevant details like descriptions, background info, team members, funding, release status, platforms, genres/tags, website links, social links, community links, store links, etc., directly from the JSON/HTML sources.\n5.  **Link Handling & Classification (VERY IMPORTANT):** Populate the \\\'relevantLinks\\\' array as the primary location for *all* discovered URLs. Find all unique URLs within the sources. Assign the \\\'type\\\' accurately based **strictly** on the URL\\\'s domain and context. \\n    *   **Correct Examples:**\\n        *   \`https://store.steampowered.com/...\` -> \`type: \'Steam\'\`\\n        *   \`https://x.com/username\` -> \`type: \'Twitter Profile\'\`\\n        *   \`https://twitter.com/username\` -> \`type: \'Twitter Profile\'\`\\n        *   \`https://discord.gg/invitecode\` -> \`type: \'Discord\'\`\\n        *   \`https://mycoolgame.com\` -> \`type: \'Official Website\'\`\\n        *   \`https://mydevstudio.com\` -> \`type: \'Official Website\'\`\\n        *   \`https://username.itch.io/gamename\` -> \`type: \'Itch.io\'\`\\n        *   \`https://kickstarter.com/projects/...\` -> \`type: \'Kickstarter\'\`\\n        *   \`https://mypublisher.com\` -> \`type: \'Publisher\'\`\\n        *   \`https://instagram.com/username\` -> \`type: \'Other Social\'\`\\n    *   **Incorrect Examples (DO NOT DO THIS):**\\n        *   \`https://x.com/username\` -> \`type: \'Official Website\'\`  **<-- WRONG**\\n        *   \`https://store.steampowered.com/...\` -> \`type: \'Official Website\'\` **<-- WRONG**\\n    *   **Rules:**\\n        *   Use \\\'Official Website\\\' **only** for a dedicated website for the game or the primary website/landing page for the developer/studio. **It MUST NOT be a social media profile (x.com, twitter.com, facebook.com, instagram.com, etc.) or a store page (steampowered.com, itch.io, etc.).**\\n        *   Use specific types (\\\'Steam\\\', \\\'Twitter Profile\\\', \\\'Discord\\\', \\\'YouTube\\\', \\\'Kickstarter\\\', \\\'Publisher\\\', \\\'Itch.io\\\', \\\'Press Kit\\\') whenever possible.\\n        *   Use \\\'Other Social\\\', \\\'Other Store\\\', \\\'Other Community\\\' for links that don\\\'t fit the specific types above.\\n        *   Use the display_url or inferred context for the \\\'name\\\' field where appropriate (e.g., name: \\\'Developer Blog\\\').\\n6.  **Demo Check:** Examine Source 5 (Raw Demo HTML Snippet). If it clearly indicates a demo (e.g., a \\\'Download Demo\\\' button), reflect this fact in the \\\'releaseInfo\\\' field (e.g., append \\\"Demo Available\\\") and add a specific entry of type \\\'Steam Demo\\\' to \\\'relevantLinks\\\' if a unique demo link/action is identifiable.\\n7.  Populate the JSON object strictly conforming to DetailedIndieGameReportSchema.\\n8.  **Use Null for Missing Data:** If information specifically required for a field (e.g., \\\'publisherName\\\', \\\'fundingInfo\\\') cannot be found in the provided sources, set that field to \\\'null\\\'.\\n9.  Provide a confidence level in \\\'aiConfidenceAssessment\\\', noting that web search was skipped.\\n10. Write a concise \\\'overallReportSummary\\\'.\\n\\nGenerate *only* the final JSON object conforming to DetailedIndieGameReportSchema.`;

  console.log(
    "Performing final AI synthesis (incl. raw demo HTML analysis)..."
  );
  const finalResult = await generateObject({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
    schema: DetailedIndieGameReportSchema,
  });

  // 6. Return the final object
  return Response.json(finalResult.object);
}
