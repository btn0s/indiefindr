import { NextRequest } from "next/server";
import { ingest } from "@/lib/ingest";
import { SubmitGameSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiNotFound,
  apiInternalError,
} from "@/lib/api/responses";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = SubmitGameSchema.parse(body);

    console.log(
      "[SUBMIT] Processing submission for:",
      input.steamUrl,
      input.force ? "(force)" : ""
    );

    const result = await ingest(input.steamUrl, input.skipSuggestions, input.force);

    return apiSuccess({
      appid: result.steamData.appid,
      title: result.steamData.title,
      steamData: result.steamData,
      suggestions: result.suggestions,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    console.error("[SUBMIT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("unavailable")
    ) {
      return apiNotFound("Steam game");
    }

    return apiInternalError(errorMessage);
  }
}

export async function GET() {
  return apiSuccess({
    description: "Submit a Steam URL for ingestion and suggestion generation",
    usage: {
      method: "POST",
      body: {
        steamUrl: "string - Required: Steam store URL or app ID",
        skipSuggestions: "boolean - Optional: Skip suggestion generation",
        force: "boolean - Optional: Force re-ingestion",
      },
    },
    example: {
      steamUrl: "https://store.steampowered.com/app/730/",
    },
  });
}
