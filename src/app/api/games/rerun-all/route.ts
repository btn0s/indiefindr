/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { ingestSteamGame } from "@/lib/ingest/ingestSteamGame";
import { IS_DEV } from "@/lib/utils/dev";

export async function POST() {
  if (!IS_DEV) {
    return NextResponse.json(
      { error: "This endpoint is only available in development mode" },
      { status: 403 }
    );
  }

  try {
    // Get all games from the database
    const { data: games, error } = await supabase
      .from("games")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch games: ${error.message}` },
        { status: 500 }
      );
    }

    if (!games || games.length === 0) {
      return NextResponse.json(
        { error: "No games found to rerun" },
        { status: 404 }
      );
    }

    // Kick off all ingests in parallel and collect outcomes
    const settled = await Promise.allSettled(
      games.map(async (game) => {
        const steamUrl = `https://store.steampowered.com/app/${game.id}/`;
        const result = await ingestSteamGame(steamUrl);
        if ("error" in result) {
          return {
            appid: game.id,
            name: game.name,
            success: false as const,
            error: result.error,
          };
        }
        return {
          appid: game.id,
          name: game.name,
          success: true as const,
        };
      })
    );

    const results: Array<{
      appid: number;
      name: string;
      success: boolean;
      error?: string;
    }> = settled.map((entry, index) => {
      if (entry.status === "fulfilled") {
        return entry.value;
      }
      return {
        appid: games[index].id,
        name: games[index].name,
        success: false,
        error:
          entry.reason instanceof Error
            ? entry.reason.message
            : "Unknown error",
      };
    });

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Processed ${games.length} games`,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
