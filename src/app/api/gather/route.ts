import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

async function fetchUrlContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        // Mimic a browser request to avoid being blocked
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      );
    }

    console.log("Response:", response);

    const text = await response.text();
    return text;
  } catch (error) {
    console.error("Error fetching URL:", error);
    return null;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userQuery = messages[messages.length - 1].content;

  // Check if the input is a URL
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = userQuery.match(urlPattern);

  // If URLs found, fetch their content
  const contents = await Promise.all(urls.map((url) => fetchUrlContent(url)));

  console.log("Contents:", contents);

  // Use the AI to analyze the fetched content
  const result = await streamText({
    model: openai.responses("gpt-4o-mini"),
    prompt: `tell me about this: ${contents}`,
    // tools: {
    //   web_search_preview: openai.tools.webSearchPreview({
    //     searchContextSize: "high",
    //     userLocation: {
    //       type: "approximate",
    //       city: "San Francisco",
    //       region: "California",
    //     },
    //   }),
    // },
    // toolChoice: { type: "tool", toolName: "web_search_preview" },
  });

  return result.toDataStreamResponse();
}
