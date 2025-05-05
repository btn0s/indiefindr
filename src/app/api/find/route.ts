import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import scrapingbee from "scrapingbee";
import * as cheerio from "cheerio";
import { DetailedIndieGameReportSchema } from "@/schema";
import { db, schema as dbSchema } from "@/db";
import { generateEmbedding } from "@/lib/embeddings";
import { eq } from "drizzle-orm";

// example string for LLM testing
// const testString = "https://x.com/Just_Game_Dev/status/1918036677609521466";
// const steamTestString = "https://store.steampowered.com/app/123456/Some_Game";

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

// ADDED: Function to search Steam game by name using RapidAPI
async function searchSteamByName(
  gameName: string
): Promise<{ appId: string; storeUrl: string } | null> {
  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured for Steam search API call.");
    return null;
  }
  if (!gameName || gameName.trim() === "") {
    console.log("Cannot search Steam by name with an empty query.");
    return null;
  }

  const url = `https://games-details.p.rapidapi.com/search?sugg=${encodeURIComponent(
    gameName.trim()
  )}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": "games-details.p.rapidapi.com",
    },
  };

  console.log(`Searching Steam via API for game name: \"${gameName}\"`);
  try {
    // Add delay if needed - maybe not needed for search endpoint?
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Failed to read error body");
      console.error(`Steam Search API Error Body: ${errorBody}`);
      throw new Error(
        `RapidAPI (games-details search) failed for name \"${gameName}\": ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();

    // Basic check for valid results - API might return empty array or specific structure
    // Adjust this check based on actual API response for no/bad results
    if (
      !result ||
      (Array.isArray(result) && result.length === 0) ||
      result.status === 404
    ) {
      console.warn(
        `Steam search API returned no results for name: \"${gameName}\"`
      );
      return null;
    }

    // TODO: Add more robust logic to pick the BEST match if multiple results
    // For now, take the first result if it looks like a game (has appId and store_url)
    const firstResult = Array.isArray(result) ? result[0] : result;
    if (firstResult && firstResult.appId && firstResult.store_url) {
      console.log(
        `Found potential Steam match by name: ID ${firstResult.appId}, URL ${firstResult.store_url}`
      );
      return {
        appId: String(firstResult.appId),
        storeUrl: firstResult.store_url,
      };
    }

    console.warn(
      `Steam search API results for \"${gameName}\" did not contain expected fields (appId, store_url) in the first item.`
    );
    return null;
  } catch (error) {
    console.error(
      `Error searching Steam for game name \"${gameName}\" via API:`,
      error
    );
    return null;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // 1. Detect URL Type and Extract ID
  const tweetUrlPattern =
    /https?:\/\/(?:x|twitter)\.com\/[^\/]+\/status\/(\d+)/i;
  const steamUrlPattern =
    /https?:\/\/store\.steampowered\.com\/app\/(\d+)\/?[^\s]*/i; // Capture AppID

  let primaryUrl: string | null = null;
  let sourceId: string | null = null;
  let sourceType: "twitter" | "steam" | null = null;

  const tweetMatch = userQuery.match(tweetUrlPattern);
  const steamMatch = userQuery.match(steamUrlPattern);

  if (tweetMatch && tweetMatch[0] && tweetMatch[1]) {
    primaryUrl = tweetMatch[0]; // Full URL
    sourceId = tweetMatch[1]; // Extracted Tweet ID
    sourceType = "twitter";
    console.log(`Detected Twitter URL: ${primaryUrl}, ID: ${sourceId}`);
  } else if (steamMatch && steamMatch[0] && steamMatch[1]) {
    primaryUrl = steamMatch[0]; // Full URL
    sourceId = steamMatch[1]; // Extracted Steam App ID
    sourceType = "steam";
    console.log(`Detected Steam URL: ${primaryUrl}, App ID: ${sourceId}`);
  }

  if (!primaryUrl || !sourceId || !sourceType) {
    return new Response(
      JSON.stringify({
        error: "No valid Twitter/X status URL or Steam App URL found in query.",
      }),
      { status: 400 }
    );
  }

  // --- Conditional Logic based on sourceType ---

  let tweetText: string | null = null;
  let tweetJson: object | null = null;
  let authorJson: object | null = null;
  let steamAppId: string | null = null; // This will store the definitive Steam App ID to use
  let profileSteamUrl: string | null = null; // Store the *best* Steam URL found/provided
  let steamApiData: any | null = null;
  let rawDemoHtml: string | null = null;

  if (sourceType === "twitter") {
    console.log("Processing as Twitter URL...");
    // 2. Fetch Raw Tweet and Author JSON data for Twitter source
    const twitterData = await fetchRawTweetAndAuthorJson(sourceId); // sourceId is tweetId here
    tweetText = twitterData.tweetText;
    tweetJson = twitterData.tweetJson;
    authorJson = twitterData.authorJson;

    if (!tweetText) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch tweet text content for ${primaryUrl}`,
        }),
        { status: 500 }
      );
    }

    // 3. Attempt to find Steam App ID AND URL from Author JSON (for Twitter source)
    console.log("Attempting to find Steam App ID and URL in author profile...");
    // Use a separate regex pattern here if needed, but steamUrlPattern should work
    // const steamProfileUrlPattern = ...

    if (authorJson) {
      try {
        // Check description entities first
        const descriptionUrls = (authorJson as any)?.result?.data?.users?.[0]
          ?.result?.legacy?.entities?.description?.urls;
        if (Array.isArray(descriptionUrls)) {
          for (const urlEntity of descriptionUrls) {
            const match = urlEntity?.expanded_url?.match(steamUrlPattern); // Use the main steam pattern
            if (match && match[1] && match[2]) {
              // match[1] is full URL, match[2] is AppID
              profileSteamUrl = match[1]; // Store the full URL found in profile
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

    // Search by name if no direct Steam App ID found
    if (!steamAppId) {
      console.log(
        "No Steam App ID found directly in author profile. Attempting search by name..."
      );
      let potentialGameName: string | null = null;

      // Strategy 1: Try author's display name
      try {
        const authorName = (authorJson as any)?.result?.data?.users?.[0]?.result
          ?.legacy?.name;
        if (authorName && authorName.length > 2) {
          potentialGameName = authorName;
          console.log(
            `Attempting search using author name: \"${potentialGameName}\".`
          );
        }
      } catch (e) {
        console.warn("Could not extract author name:", e);
      }

      // Strategy 2: Look for text in quotes in the tweet
      if (!potentialGameName && tweetText) {
        const quoteMatch = tweetText.match(/["'](.+?)["']/);
        if (quoteMatch && quoteMatch[1] && quoteMatch[1].length > 2) {
          potentialGameName = quoteMatch[1];
          console.log(
            `Attempting search using quoted text: \"${potentialGameName}\".`
          );
        }
      }

      // Strategy 3: Look for hashtags
      if (!potentialGameName && tweetText) {
        const hashtagMatch = tweetText.match(/#(\w+)/);
        if (hashtagMatch && hashtagMatch[1] && hashtagMatch[1].length > 2) {
          potentialGameName = hashtagMatch[1].replace(/_/g, " ");
          console.log(
            `Attempting search using first hashtag: \"${potentialGameName}\".`
          );
        }
      }

      if (potentialGameName) {
        const searchResult = await searchSteamByName(potentialGameName);
        if (searchResult) {
          console.log(
            `Found Steam game via name search: App ID ${searchResult.appId}`
          );
          steamAppId = searchResult.appId;
          profileSteamUrl = searchResult.storeUrl; // Use the URL from search result
        } else {
          console.log(`Steam search for \"${potentialGameName}\" failed.`);
        }
      } else {
        console.log("Could not determine game name for search.");
      }
    }
    // At this point for twitter source, steamAppId and profileSteamUrl *might* be populated
  } else if (sourceType === "steam") {
    console.log("Processing as Steam URL...");
    // Directly use the sourceId as the steamAppId and primaryUrl as the profileSteamUrl
    steamAppId = sourceId;
    profileSteamUrl = primaryUrl; // The submitted Steam URL is our primary URL
    console.log(`Using provided Steam App ID: ${steamAppId}`);
    // tweetText, tweetJson, authorJson remain null
  }

  // 4. Fetch Steam API Data AND Scrape Demo HTML if App ID was determined (from either source)
  // Note: profileSteamUrl should hold the URL to scrape (either found or submitted directly)

  if (steamAppId && profileSteamUrl) {
    // Ensure we have both ID and a URL to scrape
    console.log(`Fetching Steam API data for App ID: ${steamAppId}`);
    steamApiData = await fetchSteamDataFromApi(steamAppId);
    if (steamApiData) {
      console.log(`Scraping Steam URL for demo section: ${profileSteamUrl}`);
      rawDemoHtml = await scrapeSteamDemoSectionHtml(profileSteamUrl);
    } else {
      console.warn(
        `Failed to fetch Steam API data for App ID ${steamAppId}. Proceeding without it (and without demo check).`
      );
      // Reset rawDemoHtml if API failed, as we couldn't verify the game exists via API
      rawDemoHtml = null;
    }
  } else if (steamAppId && !profileSteamUrl) {
    console.warn(
      `Have Steam App ID ${steamAppId} but no URL to scrape for demo.`
    );
    // Optionally fetch API data even without a URL to scrape? Let's fetch it.
    console.log(
      `Fetching Steam API data for App ID: ${steamAppId} (without demo scrape).`
    );
    steamApiData = await fetchSteamDataFromApi(steamAppId);
  } else {
    console.log(
      "No Steam App ID determined. Skipping Steam API fetch and demo scrape."
    );
  }

  // 5. Final Synthesis (Adjust prompt based on available data)
  console.log("Preparing for final synthesis...");

  // --- ADJUST PROMPT GENERATION ---
  let finalSynthesisPrompt = `Analyze the following raw API data`;
  if (sourceType === "steam") {
    finalSynthesisPrompt += ` for a Steam game.`;
  } else {
    // twitter source
    finalSynthesisPrompt += ` for a Twitter tweet, the tweet author's profile, and potentially Steam game details.`;
  }
  finalSynthesisPrompt += ` Your goal is to extract and synthesize this information into a comprehensive, factual report strictly conforming to the DetailedIndieGameReportSchema JSON format. Web search was NOT performed.\n\n**Sources Provided:**\n`;

  if (sourceType === "twitter" && tweetText) {
    finalSynthesisPrompt += `\nSource 1: Original Tweet Text (for 'sourceTweetText' field and context):\n---\n${tweetText}\n---\n`;
    finalSynthesisPrompt += `\nSource 2: Tweet JSON Data:\n\`\`\`json\n${
      JSON.stringify(tweetJson, null, 2) || "Not available"
    }\n\`\`\`\n`;
    finalSynthesisPrompt += `\nSource 3: Author Profile JSON Data:\n\`\`\`json\n${
      JSON.stringify(authorJson, null, 2) || "Not available"
    }\n\`\`\`\n`;
  }

  let steamDataSourceIndex = sourceType === "twitter" ? 4 : 1;
  if (steamApiData) {
    finalSynthesisPrompt += `\nSource ${steamDataSourceIndex++}: Steam Game Details JSON Data:\n\`\`\`json\n${
      JSON.stringify(steamApiData, null, 2) || "Not available"
    }\n\`\`\`\n`;
  }

  if (rawDemoHtml) {
    finalSynthesisPrompt += `\nSource ${steamDataSourceIndex++}: Raw HTML Snippet of Steam Page Demo Section:\n\`\`\`html\n${rawDemoHtml}\n\`\`\`\n`;
  }

  // Instructions remain largely the same, but context is different based on sources
  finalSynthesisPrompt += `\n**Instructions:**\n1.  Analyze all provided sources`;
  if (sourceType === "twitter") {
    finalSynthesisPrompt += ` (Tweet, Author JSON, Steam API JSON, Raw Demo HTML Snippet).`;
  } else {
    // steam source
    finalSynthesisPrompt += ` (Steam API JSON, Raw Demo HTML Snippet).`;
  }
  finalSynthesisPrompt += `\n2.  **Strict Field Mapping:** Populate fields *only* with information that accurately matches the field's description based on the sources. Do **not** substitute information (e.g., do not put a Steam link in a field meant for an official website if the official website URL is not found).\n3.  Identify the primary game, developer, and publisher (if possible) based on the data`;
  if (sourceType === "twitter") {
    finalSynthesisPrompt += ` (prioritize Author JSON name/bio/hashtags and Steam JSON data if present).`;
  } else {
    // steam source
    finalSynthesisPrompt += ` (prioritize Steam JSON data).`;
  }
  // Rest of instructions... (keep existing instructions 4-11 from here)
  finalSynthesisPrompt += `\n4.  Extract relevant details like descriptions, background info, team members, funding, release status, platforms, genres/tags, website links, social links, community links, store links, etc., directly from the JSON/HTML sources.\n5.  **Link Handling & Classification (VERY IMPORTANT):** Populate the \\\'relevantLinks\\\' array as the primary location for *all* discovered URLs. Find all unique URLs within the sources. Assign the \\\'type\\\' accurately based **strictly** on the URL\\\'s domain and context. \\n    *   **Correct Examples:**\\n        *   \`https://store.steampowered.com/...\` -> \`type: \'Steam\'\`\\n        *   \`https://x.com/username\` -> \`type: \'Twitter Profile\'\`\\n        *   \`https://twitter.com/username\` -> \`type: \'Twitter Profile\'\`\\n        *   \`https://discord.gg/invitecode\` -> \`type: \'Discord\'\`\\n        *   \`https://mycoolgame.com\` -> \`type: \'Official Website\'\`\\n        *   \`https://mydevstudio.com\` -> \`type: \'Official Website\'\`\\n        *   \`https://username.itch.io/gamename\` -> \`type: \'Itch.io\'\`\\n        *   \`https://kickstarter.com/projects/...\` -> \`type: \'Kickstarter\'\`\\n        *   \`https://mypublisher.com\` -> \`type: \'Publisher\'\`\\n        *   \`https://instagram.com/username\` -> \`type: \'Other Social\'\`\\n    *   **Incorrect Examples (DO NOT DO THIS):**\\n        *   \`https://x.com/username\` -> \`type: \'Official Website\'\`  **<-- WRONG**\\n        *   \`https://store.steampowered.com/...\` -> \`type: \'Official Website\'\` **<-- WRONG**\\n    *   **Rules:**\\n        *   Use \\\'Official Website\\\' **only** for a dedicated website for the game or the primary website/landing page for the developer/studio. **It MUST NOT be a social media profile (x.com, twitter.com, facebook.com, instagram.com, etc.) or a store page (steampowered.com, itch.io, etc.).**\\n        *   Use specific types (\\\'Steam\\\', \\\'Twitter Profile\\\', \\\'Discord\\\', \\\'YouTube\\\', \\\'Kickstarter\\\', \\\'Publisher\\\', \\\'Itch.io\\\', \\\'Press Kit\\\') whenever possible.\\n        *   Use \\\'Other Social\\\', \\\'Other Store\\\', \\\'Other Community\\\' for links that don\\\'t fit the specific types above.\\n        *   Use the display_url or inferred context for the \\\'name\\\' field where appropriate (e.g., name: \\\'Developer Blog\\\').
6.  **Image Links (CRITICAL):** ALWAYS extract image URLs from the sources and include them in the \\\'relevantLinks\\\' array with appropriate types:\\n    *   For Steam header images (game_header_image_full): use the type \\\'Key Art\\\'\\n    *   For Steam screenshots: use the type \\\'Screenshot\\\'\\n    *   For Steam capsule images: use the type \\\'Cover Art\\\'\\n    *   For video thumbnail images: use the type \\\'Trailer Thumbnail\\\'\\n    *   If Steam API data is available, ensure you extract BOTH header and screenshots and add them with their appropriate types.\\n    *   **PRIORITY:** Always prioritize extracting official Steam images over any other image source.
7.  **Demo Check:** Examine the Raw Demo HTML Snippet (if available). If it clearly indicates a demo (e.g., a \\\'Download Demo\\\' button), reflect this fact in the \\\'releaseInfo\\\' field (e.g., append \\\"Demo Available\\\") and add a specific entry of type \\\'Steam Demo\\\' to \\\'relevantLinks\\\' if a unique demo link/action is identifiable.\\n8.  Populate the JSON object strictly conforming to DetailedIndieGameReportSchema.\\n9.  **Use Null for Missing Data:** If information specifically required for a field (e.g., \\\'publisherName\\\', \\\'fundingInfo\\\') cannot be found in the provided sources, set that field to \\\'null\\\'.\\n10. Provide a confidence level in \\\'aiConfidenceAssessment\\\', noting that web search was skipped`;
  if (sourceType === "steam") {
    finalSynthesisPrompt += ` and the primary source was a Steam URL.`;
  }
  finalSynthesisPrompt += `.\n11. Write a concise \\\'overallReportSummary\\\'.\\n\\nGenerate *only* the final JSON object conforming to DetailedIndieGameReportSchema.`;

  console.log(
    "Performing final AI synthesis (incl. raw demo HTML analysis)..."
  );
  const finalResult = await generateObject({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
    schema: DetailedIndieGameReportSchema,
  });

  // ** ADDED: Generate embedding before saving **
  let embeddingVector: number[] | null = null;
  try {
    const report = finalResult.object; // The generated report object
    // Construct text for embedding (combine key fields)
    const textToEmbed = [
      report.gameName,
      report.gameDescription,
      report.overallReportSummary,
      Array.isArray(report.genresAndTags)
        ? report.genresAndTags.join(", ")
        : null,
      report.developerName,
      report.publisherName,
    ]
      .filter(Boolean) // Remove null/undefined/empty strings
      .join("\n\n"); // Join with double newline for separation

    if (textToEmbed) {
      console.log("Generating embedding for the new find...");
      embeddingVector = await generateEmbedding(textToEmbed);
      console.log("Embedding generated successfully.");
    } else {
      console.warn(
        "Could not generate embedding: No text content found in report."
      );
    }
  } catch (embeddingError) {
    console.error(
      "Failed to generate embedding for the new find:",
      embeddingError
    );
    // Decide if you want to fail the whole process or just log and continue
    // For now, we log and continue, saving the find without an embedding.
  }

  // 6. Persist the find to the database (Update or Insert)
  console.log("Attempting to save find to database (Update or Insert)...");
  let findId: number | null = null;
  try {
    // ** Adjust how we check for existing finds **
    let existingFind: { id: number }[] | null = null;
    if (sourceType === "twitter") {
      // Original logic: check by tweet ID
      existingFind = await db
        .select({ id: dbSchema.finds.id })
        .from(dbSchema.finds)
        .where(eq(dbSchema.finds.sourceTweetId, sourceId)) // sourceId is tweetId
        .limit(1);
    } else if (sourceType === "steam") {
      // New logic: check by Steam App ID
      existingFind = await db
        .select({ id: dbSchema.finds.id })
        .from(dbSchema.finds)
        .where(eq(dbSchema.finds.sourceSteamAppId, sourceId)) // sourceId is steamAppId
        .limit(1);
      // console.warn(
      //   "Database check/save for direct Steam submissions is not fully implemented yet (requires schema change). Skipping save for now."
      // );
      // For now, skip DB operations for steam type until schema is updated
      // We can still return the report object below
    }

    // ** Construct data, potentially including new fields **
    const findDataToSave = {
      sourceTweetUrl: sourceType === "twitter" ? primaryUrl : null,
      sourceTweetId: sourceType === "twitter" ? sourceId : null,
      sourceSteamUrl: sourceType === "steam" ? primaryUrl : null, // Use submitted URL
      sourceSteamAppId: sourceType === "steam" ? sourceId : null, // Use extracted App ID
      rawTweetJson: tweetJson,
      rawAuthorJson: authorJson,
      rawSteamJson: steamApiData,
      rawDemoHtml: rawDemoHtml,
      report: finalResult.object,
      vectorEmbedding: embeddingVector, // Assuming embedding generation is adapted or handles missing data
      updatedAt: new Date(),
    };

    // ** Perform DB operations for ALL valid source types **
    if (existingFind && existingFind.length > 0) {
      // Update existing find (based on tweetId or steamAppId)
      findId = existingFind[0].id;
      console.log(`Found existing find with ID: ${findId}. Updating...`);

      // Determine the where clause based on source type
      const whereClause =
        sourceType === "twitter"
          ? eq(dbSchema.finds.sourceTweetId, sourceId)
          : eq(dbSchema.finds.sourceSteamAppId, sourceId);

      await db
        .update(dbSchema.finds)
        .set(findDataToSave) // Use the common data object
        // .where(eq(dbSchema.finds.id, findId)); // Using ID is fine too
        .where(whereClause); // Update based on the unique source identifier
      console.log(`Successfully updated find with ID: ${findId}`);
    } else {
      // Insert new find (for tweetId or steamAppId)
      console.log("No existing find found. Inserting new record...");
      const inserted = await db
        .insert(dbSchema.finds)
        .values(findDataToSave) // Use the common data object
        .returning({ id: dbSchema.finds.id });

      if (inserted && inserted.length > 0 && inserted[0].id) {
        findId = inserted[0].id;
        console.log(
          `Successfully saved new find to database with ID: ${findId}`
        );
      } else {
        console.error("Insert command succeeded but did not return a new ID.");
        throw new Error("Failed to retrieve ID after inserting new find.");
      }
    }
  } catch (error) {
    console.error("Error during database operation:", error);
    // Only return 500 if it was a real DB error, not a planned skip
    // if (sourceType === "twitter") { // REMOVED - Apply to all types
    // Or check if error is specific DB error type
    return new Response(
      JSON.stringify({
        error: "Failed to save the analysis result to the database.",
      }),
      { status: 500 }
    );
    // }
  }

  // 7. Return the final report object AND the find ID (which might be null)
  return Response.json({ report: finalResult.object, findId: findId });
}
