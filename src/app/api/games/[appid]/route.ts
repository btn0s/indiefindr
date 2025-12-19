import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const { appid } = await params;
    const appId = parseInt(appid, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: "Invalid app ID" }, { status: 400 });
    }

    // Check games_new table first (primary table)
    const { data: gameNew, error: errorNew } = await supabase
      .from("games_new")
      .select("*")
      .eq("appid", appId)
      .maybeSingle();

    if (gameNew) {
      return NextResponse.json(gameNew);
    }

    // Fallback to games table (legacy)
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", appId)
      .maybeSingle();

    if (error || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
