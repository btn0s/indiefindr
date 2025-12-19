import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { suggestGames } from "@/lib/suggest";

/**
 * POST /api/games/[appid]/suggestions/refresh
 * 
 * Refresh suggestions for a game by regenerating them using Perplexity
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
    // Fetch game data from database
    const { data: gameData, error: gameError } = await supabase
      .from("games_new")
      .select("appid, screenshots, title, short_description, long_description")
      .eq("appid", appId)
      .single();

    if (gameError || !gameData) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (!gameData.screenshots || gameData.screenshots.length === 0) {
      return NextResponse.json(
        { error: "No screenshots available for this game" },
        { status: 400 }
      );
    }

    const firstScreenshot = gameData.screenshots[0];
    
    // Build text context from game title and descriptions
    const textContext = [
      gameData.title,
      gameData.short_description,
      gameData.long_description,
    ]
      .filter(Boolean)
      .join(". ");

    console.log("[REFRESH SUGGESTIONS] Generating suggestions for:", gameData.title);
    const suggestions = await suggestGames(firstScreenshot, textContext);

    // Save suggestions to DB
    const { error: saveError } = await supabase
      .from("suggestions")
      .upsert(
        {
          steam_appid: appId,
          result_text: suggestions.result,
          usage_stats: suggestions.usage || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "steam_appid",
        }
      );

    if (saveError) {
      throw new Error(`Failed to save suggestions: ${saveError.message}`);
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.result,
    });
  } catch (error) {
    console.error("[REFRESH SUGGESTIONS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
