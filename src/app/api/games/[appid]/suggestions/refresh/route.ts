import { NextRequest, NextResponse } from "next/server";
import { refreshSuggestions } from "@/lib/ingest";

/**
 * POST /api/games/[appid]/suggestions/refresh
 *
 * Refresh suggestions for a game by generating new ones and merging with existing.
 * Auto-ingests missing suggested games in the background.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
  }

  try {
    const result = await refreshSuggestions(appId);

    return NextResponse.json({
      success: true,
      suggestions: result.suggestions,
      newCount: result.newCount,
      totalCount: result.suggestions.length,
      queuedForIngestion: result.queuedForIngestion,
    });
  } catch (error) {
    console.error("[REFRESH SUGGESTIONS] Error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    
    return NextResponse.json({ error: message }, { status });
  }
}
