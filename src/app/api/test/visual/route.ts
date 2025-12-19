import { NextRequest, NextResponse } from "next/server";
import { runVisualTest, TEST_MODELS } from "@/lib/extractors/aesthetic";

/**
 * POST /api/test/visual
 *
 * Test visual extraction with different models.
 *
 * Body:
 * {
 *   imageUrls: string[]      // Required: URLs of images to analyze
 *   gameName?: string        // Optional: Name of the game for context
 *   models?: string[]        // Optional: Specific model IDs to test (default: all)
 *   mode?: "structured" | "raw"  // Optional: Output mode (default: structured)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls, gameName, models, mode = "structured" } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "imageUrls (array of strings) is required" },
        { status: 400 }
      );
    }

    // Validate URLs
    for (const url of imageUrls) {
      if (typeof url !== "string" || !url.startsWith("http")) {
        return NextResponse.json(
          { error: `Invalid image URL: ${url}` },
          { status: 400 }
        );
      }
    }

    console.log("[API] Visual test request:");
    console.log("  Images:", imageUrls.length);
    console.log("  Game:", gameName || "(not specified)");
    console.log("  Models:", models || "all");
    console.log("  Mode:", mode);

    const results = await runVisualTest(imageUrls, gameName, models, mode);

    return NextResponse.json(results);
  } catch (error) {
    console.error("[API] Visual test error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/visual
 *
 * Get available models and usage info.
 */
export async function GET() {
  return NextResponse.json({
    description: "Visual extraction testing endpoint",
    usage: {
      method: "POST",
      body: {
        imageUrls: "string[] - Required: URLs of images to analyze",
        gameName: "string - Optional: Name of the game for context",
        models:
          "string[] - Optional: Specific model IDs to test (default: all)",
        mode: '"structured" | "raw" - Optional: Output mode (default: structured)',
      },
    },
    availableModels: TEST_MODELS,
    example: {
      imageUrls: [
        "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341650/ss_1.jpg",
        "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3341650/ss_2.jpg",
      ],
      gameName: "PIGFACE",
      mode: "structured",
    },
  });
}
