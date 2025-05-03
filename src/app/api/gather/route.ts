import { openai } from "@ai-sdk/openai";
import { generateText, streamText, generateObject } from "ai";
import scrapingbee from "scrapingbee"; // Import ScrapingBee client - will be removed if only used for Twitter
import * as cheerio from "cheerio"; // Import cheerio for HTML parsing - keep for Steam
import { GameLandingPageSchema } from "@/schema"; // UPDATED Schema import

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Keep ScrapingBee API key for potential other uses (like Steam)
const scrapingBeeApiKey = process.env.SCRAPINGBEE_API_KEY;
const rapidApiKey = process.env.RAPIDAPI_KEY; // ADDED: RapidAPI Key

// REMOVED: ScrapingBee API key check (can be removed if only used for Twitter)
// if (!scrapingBeeApiKey) {
//   console.error("SCRAPINGBEE_API_KEY environment variable is not set.");
//   // Optionally, throw an error or handle this case appropriately
// }

if (!rapidApiKey) {
  console.error("RAPIDAPI_KEY environment variable is not set.");
  // Optionally, throw an error or handle this case appropriately
}

// Keep ScrapingBee client creator for potential other uses
async function createScrapingBeeClient() {
  if (!scrapingBeeApiKey) {
    // Return null or throw an error if the API key is missing
    // This check prevents trying to create a client without a key
    console.error("Attempted to create ScrapingBee client without an API key.");
    return null;
  }
  return new scrapingbee.ScrapingBeeClient(scrapingBeeApiKey);
}

/**
 * Scrapes a non-Twitter URL using ScrapingBee and parses the HTML with Cheerio.
 * Allows enabling/disabling stealth mode.
 * (Kept for Steam scraping)
 */
async function scrapeUrlAndParse(
  url: string,
  selectorMap: { [key: string]: string }, // Map of data key to CSS selector
  useStealth: boolean
): Promise<{ [key: string]: string | null } | null> {
  const client = await createScrapingBeeClient();
  if (!client) return null;

  console.log(`Scraping URL: ${url} (Stealth: ${useStealth})`);
  try {
    const response = await client.get({
      url: url,
      params: {
        render_js: true,
        block_resources: true, // Usually good for faster text extraction
        stealth_proxy: useStealth,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `ScrapingBee failed for ${url}: ${response.status} ${response.statusText}`
      );
    }

    const decoder = new TextDecoder();
    const html = decoder.decode(response.data);
    const $ = cheerio.load(html);

    const extractedData: { [key: string]: string | null } = {};
    for (const key in selectorMap) {
      const selector = selectorMap[key];
      // Special handling for tags to get multiple elements
      if (key.toLowerCase().includes("tags")) {
        const tags = $(selector)
          .map((_, el) => $(el).text().trim())
          .get(); // Get array of strings
        extractedData[key] = tags.length > 0 ? tags.join(", ") : null;
      } else {
        extractedData[key] = $(selector).first().text().trim() || null;
      }
    }

    console.log(`Successfully scraped and parsed: ${url}`);
    return extractedData;
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return null;
  }
}

// ADDED: Function to fetch tweet content using RapidAPI
async function fetchTweetContent(tweetId: string): Promise<string | null> {
  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured.");
    return null;
  }

  const url = `https://twitter241.p.rapidapi.com/tweet-v2?pid=${tweetId}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": "twitter241.p.rapidapi.com",
    },
  };

  console.log(`Fetching tweet content for ID: ${tweetId}`);
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(
        `RapidAPI failed for tweet ${tweetId}: ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();
    // Extract text based on observed structure
    const tweetText = result?.result?.tweetResult?.result?.legacy?.full_text;
    if (!tweetText) {
      console.warn(
        "Could not extract tweet text from RapidAPI response structure:",
        result
      );
      return null;
    }
    console.log(`Successfully fetched tweet content for ID: ${tweetId}`);
    return tweetText;
  } catch (error) {
    console.error(`Error fetching tweet ${tweetId} via RapidAPI:`, error);
    return null;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // 1. Extract Tweet URL and ID from initial user query
  const tweetUrlPattern =
    /https?:\/\/(?:x|twitter)\.com\/[^\/]+\/status\/(\d+)/i; // Corrected: Use single backslashes for escaping in regex literal
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

  // 2. Fetch the tweet content using RapidAPI
  const tweetContent = await fetchTweetContent(tweetId); // Use new function

  if (!tweetContent) {
    return new Response(
      JSON.stringify({
        error: `Failed to fetch tweet content for ${primaryUrl}`,
      }),
      {
        status: 500,
      }
    );
  }

  // 3. Initial AI call with web search to find comprehensive game/dev info
  const initialPrompt = `Analyze the following indie game developer tweet content:
---
${tweetContent}
---
Based *only* on the tweet, identify the developer/studio name and the game name if mentioned.

Then, perform an extensive web search to gather as much information as possible for a detailed game landing page. Find details for *all* of the following fields:

**Game Information:**
- Game Name (confirm or find)
- Tagline
- Short Description (1-2 sentences)
- Detailed Description (gameplay, story, unique selling points)
- Genres (list)
- Tags (list, more specific than genres)
- Platforms (PC, Mac, Linux, PS5, Xbox Series X/S, Switch, iOS, Android, etc.)
- Release Status (Released, Early Access, Announced, TBA, etc.)
- Release Date (if known)
- Price (if known)
- Official Game Website URL
- Steam Store URL (MUST find store.steampowered.com/app/... link if it exists)
- Other Store URLs (Epic, GOG, itch.io, console stores - provide name and URL)
- Trailer Video URL (YouTube, Vimeo, etc.)
- Screenshot URLs (list of direct image URLs if possible)
- Key Features (bullet points/list)

**Developer / Team Information:**
- Developer/Studio Name (confirm or find)
- Developer Website URL
- Developer Location (Country/City/Remote)
- Team Background (Detailed history, founding story, previous projects, mission/values)
- Team Members (Identify key members and their roles)
- Social Media Links (Platform and URL for Twitter, Discord, Facebook, etc.)

**Community & Links:**
- Press Kit URL
- Discord Invite URL
- Subreddit URL
- Other Community Links (Forums, wikis - provide name and URL)

**Funding Information:**
- Funding Status (Self-funded, Kickstarter, Patreon, etc.)
- Funding Page URL (Kickstarter, Patreon link, etc.)

Provide a comprehensive summary of all findings from the web search. Clearly list all URLs found. Prioritize finding the Steam Store URL.
`;

  console.log("Performing initial AI search with generateText...");
  const initialResult = await generateText({
    model: openai.responses("gpt-4o-mini"),
    prompt: initialPrompt,
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: "high",
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search_preview" },
  });

  const initialAiText = initialResult.text;
  console.log("Initial AI Search Result Text:", initialAiText);

  // 4. Try to extract Steam URL from the initial AI response
  const steamUrlPattern =
    /https?:\/\/store\.steampowered\.com\/app\/\d+\/?[^\s]*/;
  const steamUrlMatch = initialAiText.match(steamUrlPattern);
  let steamData: { [key: string]: string | null } | null = null;

  if (steamUrlMatch && steamUrlMatch[0]) {
    const steamUrl = steamUrlMatch[0];
    console.log(`Found Steam URL: ${steamUrl}`);

    // 5. Scrape Steam page (NO stealth) if URL found
    // Selectors are best guesses and might need adjustment!
    const steamSelectors = {
      description: "#game_area_description .game_description_snippet", // Main description snippet
      tags: ".glance_tags a.app_tag", // Genre tags
      // Add more selectors here if needed (e.g., release date, developer)
      // developer: ".dev_row .summary a"
    };
    steamData = await scrapeUrlAndParse(steamUrl, steamSelectors, false); // NO stealth for Steam
  } else {
    console.log("No Steam URL found in initial AI response.");
  }

  // 6. Final AI call to synthesize everything into the new schema
  let finalSynthesisPrompt = `Synthesize all the following information into a comprehensive, structured JSON object conforming to the GameLandingPageSchema. Populate every field as accurately as possible based on the provided data. If specific information for a field wasn't found in the preceding steps, use 'null' for that field unless it's a required string (like tweetSummary).

Original Tweet Content Summary (for the 'tweetSummary' field):
---
${tweetContent}
---

Initial Web Search Summary & Findings (for context and filling fields):
---
${initialAiText}
---
`;

  if (steamData) {
    finalSynthesisPrompt += `
Scraped Steam Page Details (use for 'scrapedSteamDescription' and potentially 'genres', 'tags', 'detailedDescription'):
---
Description: ${steamData.description || "Not found"}
Tags/Genres: ${steamData.tags || "Not found"}
---
`;
  }

  finalSynthesisPrompt += `
Based on all the information provided (original tweet summary, initial web search summary, and scraped Steam details), generate the final JSON object using the GameLandingPageSchema. Extract and structure the relevant pieces of information into the corresponding fields. Provide a concise overall summary in the 'overallSummary' field.
`;

  console.log(
    "Performing final AI synthesis with generateObject using GameLandingPageSchema..."
  );
  const finalResult = await generateObject({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
    schema: GameLandingPageSchema, // UPDATED to use the new schema
  });

  // 7. Return the final object as a standard JSON response
  return Response.json(finalResult.object);
}
