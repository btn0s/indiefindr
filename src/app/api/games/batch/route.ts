import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

type Body = {
  appids?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const appids = body.appids;

    if (!Array.isArray(appids) || appids.length === 0) {
      return NextResponse.json(
        { error: "appids (number[]) is required" },
        { status: 400 }
      );
    }

    const parsed = appids
      .map((id) => (typeof id === "number" ? id : parseInt(String(id), 10)))
      .filter((id) => Number.isFinite(id) && id > 0);

    // Basic safety limits to avoid giant `IN (...)` queries.
    const unique = Array.from(new Set(parsed)).slice(0, 60);
    if (unique.length === 0) {
      return NextResponse.json(
        { error: "No valid app IDs provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("games_new")
      .select(
        "appid, title, header_image, screenshots, videos, short_description, long_description, raw, suggested_game_appids, created_at, updated_at"
      )
      .in("appid", unique);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ games: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

