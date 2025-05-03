import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const { text } = await generateText({
    model: openai("o3-mini"),
    prompt: messages[messages.length - 1].content,
  });

  return Response.json({ text });
}
