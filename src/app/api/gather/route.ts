import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai.responses("gpt-4o-mini"),
    prompt: messages[messages.length - 1].content,
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: "high",
        userLocation: {
          type: "approximate",
          city: "San Francisco",
          region: "California",
        },
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search_preview" },
  });

  return result.toDataStreamResponse();
}
