import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }

    const searchQuery = query.trim();

    // Search in games_new table by title (case-insensitive)
    const { data: games, error } = await supabase
      .from("games_new")
      .select("appid, title, header_image")
      .ilike("title", `%${searchQuery}%`)
      .order("title", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(games || []);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Search error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
