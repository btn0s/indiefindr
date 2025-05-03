import { openai } from "@ai-sdk/openai";
import { generateText, streamText, generateObject } from "ai";
import scrapingbee from "scrapingbee"; // Import ScrapingBee client - will be removed if only used for Twitter
import * as cheerio from "cheerio"; // Import cheerio for HTML parsing - keep for Steam
import { DetailedIndieGameReportSchema } from "@/schema"; // UPDATED Schema import

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

  // 3. Generate Context Summary from Raw JSON using AI
  let contextSummary = "";
  const summaryGenPrompt = `Analyze the raw JSON data for a tweet and its author's profile. Your goal is to extract key factual context for a deep-dive web search, with a focus on accurately identifying the PRIMARY game and developer/studio being discussed.

Key areas to check for names:
- Tweet text content
- Tweet hashtags (e.g., #BombshellBlitz)
- Author's display name (e.g., "sully 💣 wishlist bombshell blitz")
- Author's profile description/bio
- URLs mentioned in bio or tweet

Instructions:
1. Identify the most probable primary game name. Prioritize names explicitly mentioned in hashtags, display name, or bio.
2. Identify the most probable primary developer/studio name.
3. Identify any potential publisher names mentioned.
4. Extract other useful context: key people, locations, project codenames, relevant links.
5. If there is ambiguity (e.g., multiple potential game names), briefly note it.
6. Summarize all extracted context concisely.

Tweet JSON:
\`\`\`json
${JSON.stringify(tweetJson, null, 2) || "Not available"}
\`\`\`

Author Profile JSON:
\`\`\`json
${JSON.stringify(authorJson, null, 2) || "Not available"}
\`\`\`

Generate *only* the concise summary of factual context, highlighting the most likely game/dev entities.`;

  try {
    console.log("Generating context summary from raw JSON...");
    const summaryResult = await generateText({
      model: openai.responses("gpt-4o-mini"),
      prompt: summaryGenPrompt,
      maxTokens: 300, // Allow more tokens for summary
    });
    contextSummary = summaryResult.text.trim();
    console.log("Generated Context Summary:", contextSummary);
    if (!contextSummary) {
      throw new Error("AI failed to generate context summary.");
    }
  } catch (error) {
    console.error("Error generating context summary:", error);
    // Fallback: Use only the tweet text if summary generation fails
    contextSummary = tweetText;
    console.warn("Using raw tweet text as fallback context.");
  }

  // 4. Generate an Optimized Web Search Query using the AI-generated Summary
  let webSearchQuery = "";
  const queryGenPrompt = `Based *only* on the following context summary (derived from a tweet and author profile), generate the most effective web search query possible. Focus the query on the *primary game and developer/studio names* identified in the summary.

The goal is to find *in-depth, accurate information* covering all aspects of THAT specific game and its creators:
- Game Details: Description, gameplay, features, genres, tags, platforms, release status/date, price.
- Developer Details: Background, history, team members & roles, location.
- Publisher Details: Name, website, relationship.
- Funding Details: Source, status, links.
- Online Presence: Official websites, social media, community hubs, video channels, store pages (Steam!), press kit.

Context Summary:
---
${contextSummary}
---

Generate *only* the single, optimized web search query string targeting the primary game/developer identified in the summary.`;

  try {
    console.log("Generating optimized web search query from summary...");
    const queryResult = await generateText({
      model: openai.responses("gpt-4o-mini"),
      prompt: queryGenPrompt,
      maxTokens: 100,
    });
    webSearchQuery = queryResult.text.trim();
    console.log("Generated web search query:", webSearchQuery);
    if (!webSearchQuery) {
      throw new Error("AI failed to generate a web search query from summary.");
    }
  } catch (error) {
    console.error("Error generating web search query from summary:", error);
    // Fallback: Use a very basic query if generation fails
    webSearchQuery = `game developer info from tweet ${tweetId}`;
    console.warn("Using fallback search query:", webSearchQuery);
  }

  // 5. Perform Web Search using the generated query
  console.log(
    `Performing web search with generated query: \"${webSearchQuery}\"`
  );
  const webSearchResult = await generateText({
    model: openai.responses("gpt-4o-mini"),
    prompt: webSearchQuery,
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: "high",
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search_preview" },
  });

  const webSearchResultsText = webSearchResult.text;
  console.log("Web Search Result Text:", webSearchResultsText);

  // 6. Try to extract Steam URL and Scrape Steam Page
  const steamUrlPattern =
    /https?:\/\/store\.steampowered\.com\/app\/\d+\/?[^\s]*/;
  const steamUrlMatch = webSearchResultsText.match(steamUrlPattern);
  let steamData: { [key: string]: string | null } | null = null;

  if (steamUrlMatch && steamUrlMatch[0]) {
    const steamUrl = steamUrlMatch[0];
    console.log(`Found Steam URL: ${steamUrl}`);
    const steamSelectors = {
      description: "#game_area_description .game_description_snippet",
      tags: ".glance_tags a.app_tag",
    };
    steamData = await scrapeUrlAndParse(steamUrl, steamSelectors, false);
  } else {
    console.log("No Steam URL found in web search results.");
  }

  // 7. Final AI call to synthesize everything into the DETAILED REPORT schema
  let finalSynthesisPrompt = `Synthesize all the following information into a comprehensive, factual report using the DetailedIndieGameReportSchema JSON format. Populate every field as accurately and completely as possible based *only* on the provided sources. Prioritize factual accuracy and cross-reference information between sources.

Source 1: Original Tweet Text (for 'sourceTweetText' field and context):
---
${tweetText}
---

Source 2: Web Search Results (main source for filling most report fields):
---
${webSearchResultsText}
---
`;

  if (steamData) {
    finalSynthesisPrompt += `\nSource 3: Scraped Steam Page Details (use for 'scrapedSteamDescription', 'scrapedSteamTags', and to supplement fields like 'gameDescription', 'genresAndTags', 'releaseInfo'):\n---\nDescription: ${
      steamData.description || "Not found"
    }\nTags/Genres: ${steamData.tags || "Not found"}\n---\n`;
  }

  finalSynthesisPrompt += `\nInstructions:
1.  Analyze all provided sources (Tweet, Web Search Results, Steam Data).
2.  Cross-reference information across sources to determine the most accurate game name, developer name, publisher name, etc. For example, check if the Steam page title matches the game name mentioned in the tweet/bio.
3.  Populate the JSON object strictly conforming to DetailedIndieGameReportSchema.
4.  For 'relevantLinks', create a comprehensive list of *all* unique URLs found, correctly assigning the 'type' and 'name'.
5.  Synthesize information accurately for description fields ('gameDescription', 'developerBackground', etc.).
6.  List identified 'teamMembers' and 'genresAndTags'.
7.  Provide a confidence level in 'aiConfidenceAssessment'. If there were significant contradictions or ambiguities between sources (e.g., conflicting game names), mention it here.
8.  Write a concise 'overallReportSummary' paragraph focusing on confirmed facts.
9.  Use 'null' for fields where no reliable information was found.

Generate *only* the final JSON object conforming to DetailedIndieGameReportSchema.`;

  console.log(
    "Performing final AI synthesis into DetailedIndieGameReportSchema..."
  );
  const finalResult = await generateObject({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
    schema: DetailedIndieGameReportSchema,
  });

  // 8. Return the final object
  return Response.json(finalResult.object);
}
