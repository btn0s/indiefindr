import { openai } from "@ai-sdk/openai";
import { streamText, generateText, tool } from "ai";
import scrapingbee from "scrapingbee"; // Import ScrapingBee client
import * as cheerio from "cheerio"; // Import cheerio for HTML parsing

// Make sure to set SCRAPINGBEE_API_KEY in your environment variables
const scrapingBeeApiKey = process.env.SCRAPINGBEE_API_KEY;

if (!scrapingBeeApiKey) {
  console.error("SCRAPINGBEE_API_KEY environment variable is not set.");
  // Optionally, throw an error or handle this case appropriately
}

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
 * Scrapes a URL using ScrapingBee and parses the HTML with Cheerio.
 * Allows enabling/disabling stealth mode.
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

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // 1. Extract URLs from initial user query (e.g., tweet URL)
  const urlPattern = /https?:\/\/[^\s]+/g;
  const initialUrls = userQuery.match(urlPattern);

  if (!initialUrls || initialUrls.length === 0) {
    return new Response(JSON.stringify({ error: "No URL found in query." }), {
      status: 400,
    });
  }
  const primaryUrl = initialUrls[0]; // Assuming the first URL is the main one (e.g., tweet)

  // 2. Scrape the primary URL (e.g., tweet content)
  const tweetSelectors = { tweetText: 'article[data-testid="tweet"]' };
  const tweetData = await scrapeUrlAndParse(primaryUrl, tweetSelectors, true); // Use stealth for Twitter/X
  const tweetContent = tweetData?.tweetText;

  if (!tweetContent) {
    return new Response(
      JSON.stringify({ error: `Failed to scrape content from ${primaryUrl}` }),
      {
        status: 500,
      }
    );
  }

  // 3. Initial AI call with web search to find related info (including Steam URL)
  const initialPrompt = `Analyze the following indie game developer tweet content:
---
${tweetContent}
---
Based on the tweet, identify the developer/studio and the game mentioned.
Then, search the web to find the following information:
- Developer/Studio: Background, history, official website.
- Game: Official website, **Steam store page link (MUST be store.steampowered.com/app/...)**, Kickstarter/funding page (if any), genre.
Provide a concise summary and list the URLs found, especially the Steam store page URL.
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

  // 6. Final AI call to synthesize everything
  let finalSynthesisPrompt = `Synthesize all the following information into a comprehensive summary about the indie developer and their game. Include relevant URLs found previously.

Original Tweet Content:
---
${tweetContent}
---

Initial Web Search Summary:
---
${initialAiText}
---
`;

  if (steamData) {
    finalSynthesisPrompt += `
Scraped Steam Page Details:
---
Description: ${steamData.description || "Not found"}
Tags/Genres: ${steamData.tags || "Not found"}
---
`;
  }

  finalSynthesisPrompt += `
Please provide a final, structured report.`;

  console.log("Performing final AI synthesis with streamText...");
  const finalResult = await streamText({
    model: openai.responses("gpt-4o-mini"),
    prompt: finalSynthesisPrompt,
  });

  // 7. Return the final synthesized stream
  return finalResult.toDataStreamResponse();
}
