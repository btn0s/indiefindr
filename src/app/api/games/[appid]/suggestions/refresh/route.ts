import { NextRequest, NextResponse } from "next/server";
import { refreshSuggestions, clearSuggestions } from "@/lib/ingest";
import { IS_DEV } from "@/lib/utils/dev";

/**
 * POST /api/games/[appid]/suggestions/refresh
 *
 * Refresh suggestions for a game by generating new ones and merging with existing.
 * Auto-ingests missing suggested games in the background.
 * 
 * Query params:
 * - force=true: Clear existing suggestions first (dev-only)
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

  // Check for force param (dev-only)
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  if (force && !IS_DEV) {
    return NextResponse.json({ error: "Force refresh is dev-only" }, { status: 403 });
  }

  try {
    // Clear existing suggestions if force mode
    if (force) {
      console.log(`[REFRESH] Force mode: clearing suggestions for ${appId}`);
      await clearSuggestions(appId);
    }

    const result = await refreshSuggestions(appId);

    return NextResponse.json({
      success: true,
      suggestions: result.suggestions,
      newCount: result.newCount,
      totalCount: result.suggestions.length,
      queuedForIngestion: result.queuedForIngestion,
      forced: force,
    });
  } catch (error) {
    console.error("[REFRESH SUGGESTIONS] Error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    
    return NextResponse.json({ error: message }, { status });
  }
}
