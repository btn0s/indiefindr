import { NextRequest, NextResponse } from "next/server";
import { ingest } from "@/lib/ingest";

/**
 * @deprecated This endpoint is deprecated. Use /api/submit instead.
 * This endpoint will be removed in a future version.
 */
export async function POST(request: NextRequest) {
  console.warn(
    "[DEPRECATED] /api/games/ingest is deprecated. Use /api/submit instead."
  );

  // Return deprecation warning in response headers
  const headers = new Headers();
  headers.set("X-Deprecated", "true");
  headers.set("X-Deprecated-Message", "Use /api/submit instead");
  
  try {
    const body = await request.json();
    const { steamUrl, steamUrls } = body;

    // Single ingest (backward compatible)
    if (steamUrl && typeof steamUrl === "string") {
      const result = await ingest(steamUrl);
      return NextResponse.json(
        { gameId: result.steamData.appid },
        { headers }
      );
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
          { status: 400, headers }
        );
      }

      const settled = await Promise.allSettled(
        uniqueUrls.map((url) => ingest(url))
      );

      const results = settled.map((entry, index) => {
        const url = uniqueUrls[index];
        if (entry.status === "fulfilled") {
          return {
            url,
            success: true,
            gameId: entry.value.steamData.appid,
          };
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

      return NextResponse.json(
        {
          message: `Processed ${results.length} urls`,
          successCount,
          failureCount,
          results,
        },
        { headers }
      );
    }

    return NextResponse.json(
      { error: "steamUrl (string) or steamUrls (array) is required" },
      { status: 400, headers }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers }
    );
  }
}
