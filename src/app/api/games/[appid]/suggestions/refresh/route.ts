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
    // Fetch game data including existing suggestions
    const { data: gameData, error: gameError } = await supabase
      .from("games_new")
      .select("screenshots, title, short_description, long_description, suggested_game_appids")
      .eq("appid", appId)
      .single();

    if (gameError || !gameData) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (!gameData.screenshots || gameData.screenshots.length === 0) {
      return NextResponse.json(
        { error: "No screenshots available" },
        { status: 400 }
      );
    }

    const firstScreenshot = gameData.screenshots[0];
    const textContext = [
      gameData.title,
      gameData.short_description,
      gameData.long_description,
    ]
      .filter(Boolean)
      .join(". ");

    console.log("[REFRESH SUGGESTIONS] Generating suggestions for:", gameData.title);
    const suggestions = await suggestGames(firstScreenshot, textContext);

    // Find games that already suggest this game (bidirectional linking)
    const { data: reverseLinks } = await supabase
      .from("games_new")
      .select("appid")
      .contains("suggested_game_appids", [appId]);

    const reverseLinkAppIds = (reverseLinks || []).map((g) => g.appid);

    // Merge: new suggestions + reverse links + existing (deduplicated)
    const existingAppIds: number[] = gameData.suggested_game_appids || [];
    const newAppIds = suggestions.validatedAppIds;
    const mergedAppIds = [...new Set([...newAppIds, ...reverseLinkAppIds, ...existingAppIds])];

    // Save to DB
    const { error: saveError } = await supabase
      .from("games_new")
      .update({
        suggested_game_appids: mergedAppIds,
        updated_at: new Date().toISOString(),
      })
      .eq("appid", appId);

    if (saveError) {
      throw new Error(`Failed to save suggestions: ${saveError.message}`);
    }

    // Add this game to each suggested game's list (make it bidirectional)
    for (const suggestedAppId of newAppIds) {
      const { data: suggestedGame } = await supabase
        .from("games_new")
        .select("suggested_game_appids")
        .eq("appid", suggestedAppId)
        .maybeSingle();

      if (suggestedGame) {
        const theirSuggestions: number[] = suggestedGame.suggested_game_appids || [];
        if (!theirSuggestions.includes(appId)) {
          await supabase
            .from("games_new")
            .update({
              suggested_game_appids: [...theirSuggestions, appId],
              updated_at: new Date().toISOString(),
            })
            .eq("appid", suggestedAppId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      validatedAppIds: mergedAppIds,
      newCount: newAppIds.length,
      totalCount: mergedAppIds.length,
      reverseLinkCount: reverseLinkAppIds.length,
    });
  } catch (error) {
    console.error("[REFRESH SUGGESTIONS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
