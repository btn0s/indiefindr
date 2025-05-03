import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await generateText({
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

  const response = await result.response;

  console.log(response);

  return Response.json(response.messages);
}
