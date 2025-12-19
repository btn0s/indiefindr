import { NextRequest, NextResponse } from "next/server";
import { ingest } from "@/lib/ingest";

/**
 * POST /api/games/submit
 *
 * Submit a Steam URL for ingestion and suggestion generation.
 *
 * Body:
 * {
 *   steamUrl: string       // Required: Steam store URL or app ID
 *   skipSuggestions?: bool // Optional: If true, only fetch Steam data (no suggestions)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { steamUrl, skipSuggestions } = body;

    if (!steamUrl || typeof steamUrl !== "string") {
      return NextResponse.json(
        { error: "steamUrl (string) is required" },
        { status: 400 }
      );
    }

    console.log("[SUBMIT] Processing submission for:", steamUrl);

    const result = await ingest(steamUrl, skipSuggestions === true);

    return NextResponse.json({
      success: true,
      appid: result.steamData.appid,
      title: result.steamData.title,
      steamData: result.steamData,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error("[SUBMIT] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/games/submit
 *
 * Get usage info for the endpoint.
 */
export async function GET() {
  return NextResponse.json({
    description: "Submit a Steam URL for ingestion and suggestion generation",
    usage: {
      method: "POST",
      body: {
        steamUrl: "string - Required: Steam store URL or app ID",
      },
    },
    example: {
      steamUrl: "https://store.steampowered.com/app/730/",
    },
  });
}
