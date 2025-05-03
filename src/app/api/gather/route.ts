import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
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

async function fetchUrlContent(url: string): Promise<string | null> {
  const client = await createScrapingBeeClient();
  if (!client) {
    console.error("ScrapingBee client could not be initialized.");
    return null; // Return null or handle error as appropriate
  }

  try {
    console.log(`Scraping URL with ScrapingBee for tweet content: ${url}`);
    const response = await client.get({
      url: url,
      params: {
        render_js: true, // Keep JS rendering enabled, likely needed for Twitter/X
        // extract_rules commented out as per user change, parsing HTML manually now
        // extract_rules: JSON.stringify({
        //   tweet_content: "article[data-testid]",
        // }),
        block_resources: true, // Keep blocking resources
        stealth_proxy: true, // Keep stealth proxy
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `ScrapingBee failed with status: ${response.status} ${
          response.statusText
        }. Response: ${await response.data?.text()}`
      );
    }

    // Decode the raw HTML response
    const decoder = new TextDecoder();
    const html = decoder.decode(response.data);

    // Parse the HTML using cheerio
    const $ = cheerio.load(html);

    // Find the tweet article element and extract its text
    // Note: Twitter/X HTML can be complex. This selector might need refinement
    // if there are multiple such articles or nested structures.
    // .text() gets the combined text content of the element and its descendants.
    const tweetText = $('article[data-testid="tweet"]').text();

    if (!tweetText || tweetText.trim() === "") {
      console.warn(
        `Could not find or extract text from article[data-testid="tweet"] for: ${url}`
      );
      // Optional: Log the full HTML for debugging if needed
      // console.log("Full HTML:", html);
      return null;
    }

    console.log(`Successfully extracted tweet text for: ${url}`);
    // Return the extracted plain text
    return tweetText.trim();
  } catch (error) {
    console.error(`Error fetching URL ${url} with ScrapingBee:`, error);
    return null;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // Check if the input is a URL
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = userQuery.match(urlPattern);

  // If no URLs found, handle appropriately (e.g., return an error or different response)
  if (!urls || urls.length === 0) {
    // Decide how to handle cases where no URLs are provided
    // For now, let's proceed but contents will be empty/null
    console.log("No URLs found in the user query.");
  }

  // If URLs found, fetch their content
  // Filter out potential null results from failed scrapes
  const contents = (
    await Promise.all(
      (urls || []).map((url: string) => fetchUrlContent(url)) // Add type annotation for url
    )
  ).filter((content): content is string => content !== null); // Filter out nulls and assert type

  console.log("Fetched Contents:", contents); // Log the actual fetched content

  // Handle case where all scrapes failed or no URLs were found
  if (contents.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Could not fetch content from the provided URL(s).",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
    // Or, stream back a message indicating failure
  }

  // Join contents for the prompt, handle potentially large combined content if necessary
  const combinedContent = contents.join("\n\n---\n\n"); // Simple join, consider truncation if needed

  // Use the AI to analyze the fetched content
  const result = await streamText({
    model: openai.responses("gpt-4o-mini"),
    prompt: `Summarize the key information from the following extracted tweet content:\n\n${combinedContent}`,
  });

  return result.toDataStreamResponse();
}
