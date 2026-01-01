import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const { appid } = await params;
    const appId = parseInt(appid, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("games_new")
      .select("appid, title, suggested_game_appids, updated_at")
      .eq("appid", appId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({
      appid: data.appid,
      title: data.title,
      suggestions: data.suggested_game_appids || [],
      updatedAt: data.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

