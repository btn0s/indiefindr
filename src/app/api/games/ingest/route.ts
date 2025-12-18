import { NextRequest, NextResponse } from "next/server";
import {
  ingestSteamGame,
  quickIngestSteamGame,
} from "@/lib/ingest/ingestSteamGame";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { steamUrl, steamUrls } = body;

    // Single ingest (backward compatible)
    if (steamUrl && typeof steamUrl === "string") {
      // Use quick ingest for immediate response, then continue processing in background
      const quickResult = await quickIngestSteamGame(steamUrl);
      if ("error" in quickResult) {
        return NextResponse.json({ error: quickResult.error }, { status: 500 });
      }

      // Start full ingestion in background (don't await)
      ingestSteamGame(steamUrl).catch((err) => {
        console.error(
          `Background ingestion failed for ${quickResult.gameId}:`,
          err
        );
      });

      // Return immediately with gameId for navigation
      return NextResponse.json({ gameId: quickResult.gameId });
    }

    // Batch ingest
    if (Array.isArray(steamUrls) && steamUrls.length > 0) {
      const uniqueUrls = Array.from(
        new Set(
          steamUrls
            .filter((u) => typeof u === "string" && u.trim().length > 0)
            .map((u) => u.trim())
        )
      );

      if (uniqueUrls.length === 0) {
        return NextResponse.json(
          { error: "steamUrls must contain at least one valid URL" },
          { status: 400 }
        );
      }

      const settled = await Promise.allSettled(
        uniqueUrls.map((url) => ingestSteamGame(url))
      );

      const results = settled.map((entry, index) => {
        const url = uniqueUrls[index];
        if (entry.status === "fulfilled") {
          const value = entry.value;
          if ("error" in value) {
            return { url, success: false, error: value.error, jobId: value.jobId };
          }
          return { url, success: true, jobId: value.jobId, gameId: value.gameId };
        }
        return {
          url,
          success: false,
          error:
            entry.reason instanceof Error
              ? entry.reason.message
              : "Unknown error",
        };
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      return NextResponse.json({
        message: `Processed ${results.length} urls`,
        successCount,
        failureCount,
        results,
      });
    }

    return NextResponse.json(
      { error: "steamUrl (string) or steamUrls (array) is required" },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
