import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { suggestGames } from "@/lib/suggest";
import { ingest } from "@/lib/ingest";
import { Suggestion } from "@/lib/supabase/types";

/**
 * POST /api/games/[appid]/suggestions/refresh
 *
 * Refresh suggestions by calling suggestGames() and merging the response with existing suggestions.
 * Auto-ingests missing suggested games via ingest().
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
    // Fetch game data
    const { data: gameData, error: gameError } = await supabase
      .from("games_new")
      .select(
        "screenshots, title, short_description, long_description, suggested_game_appids"
      )
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

    // Call suggestGames() - this is the main work
    const firstScreenshot = gameData.screenshots[0];
    const textContext = [
      gameData.title,
      gameData.short_description,
      gameData.long_description,
    ]
      .filter(Boolean)
      .join(". ");

    console.log(
      "[REFRESH SUGGESTIONS] Generating suggestions for:",
      gameData.title
    );
    const result = await suggestGames(firstScreenshot, textContext);

    // Merge new suggestions with existing (deduplicated by appId, preferring new explanations)
    const existingSuggestions: Suggestion[] =
      gameData.suggested_game_appids || [];
    const newSuggestions = result.suggestions;

    const suggestionMap = new Map<number, Suggestion>();
    for (const s of existingSuggestions) {
      suggestionMap.set(s.appId, s);
    }
    for (const s of newSuggestions) {
      suggestionMap.set(s.appId, s);
    }
    const mergedSuggestions = Array.from(suggestionMap.values());

    // Save merged suggestions
    const { error: saveError } = await supabase
      .from("games_new")
      .update({
        suggested_game_appids: mergedSuggestions,
        updated_at: new Date().toISOString(),
      })
      .eq("appid", appId);

    if (saveError) {
      throw new Error(`Failed to save suggestions: ${saveError.message}`);
    }

    // Add this game to each suggested game's list (make it bidirectional)
    for (const suggestion of newSuggestions) {
      const { data: suggestedGame } = await supabase
        .from("games_new")
        .select("suggested_game_appids")
        .eq("appid", suggestion.appId)
        .maybeSingle();

      if (suggestedGame) {
        const theirSuggestions: Suggestion[] =
          suggestedGame.suggested_game_appids || [];
        const alreadyHasLink = theirSuggestions.some((s) => s.appId === appId);
        if (!alreadyHasLink) {
          await supabase
            .from("games_new")
            .update({
              suggested_game_appids: [
                ...theirSuggestions,
                { appId, explanation: "Suggested by similar game" },
              ],
              updated_at: new Date().toISOString(),
            })
            .eq("appid", suggestion.appId);
        }
      }
    }

    // Auto-ingest missing games via ingest()
    const mergedAppIds = mergedSuggestions.map((s) => s.appId);
    const { data: existingGames } = await supabase
      .from("games_new")
      .select("appid")
      .in("appid", mergedAppIds);

    const existingAppids = new Set((existingGames || []).map((g) => g.appid));
    const missingAppids = mergedAppIds.filter((id) => !existingAppids.has(id));

    if (missingAppids.length > 0) {
      console.log(
        `[REFRESH SUGGESTIONS] Auto-ingesting ${missingAppids.length} missing games...`
      );

      // Fire off background ingestion but don't wait for it
      (async () => {
        for (const missingAppid of missingAppids) {
          const steamUrl = `https://store.steampowered.com/app/${missingAppid}/`;
          try {
            await ingest(steamUrl);
            console.log(
              `[REFRESH SUGGESTIONS] Successfully auto-ingested ${missingAppid}`
            );
          } catch (err) {
            console.error(
              `[REFRESH SUGGESTIONS] Failed to auto-ingest ${missingAppid}:`,
              err instanceof Error ? err.message : String(err)
            );
          }
        }
        console.log(
          `[REFRESH SUGGESTIONS] Completed auto-ingestion of ${missingAppids.length} games`
        );
      })().catch(console.error);
    }

    return NextResponse.json({
      success: true,
      suggestions: mergedSuggestions,
      newCount: newSuggestions.length,
      totalCount: mergedSuggestions.length,
      queuedForIngestion: missingAppids.length,
    });
  } catch (error) {
    console.error("[REFRESH SUGGESTIONS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
