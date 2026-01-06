import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SteamStoreSearchItem = {
  id: number;
  name: string;
  type?: string;
  tiny_image?: string | null;
  small_image?: string | null;
};

type SteamStoreSearchResponse = {
  items?: SteamStoreSearchItem[];
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ db: [], steam: [] });
    }

    const searchQuery = query.trim();

    // Search in games_new table by title (case-insensitive)
    const { data: dbGames, error } = await supabase
      .from("games_new")
      .select("appid, title, header_image")
      .ilike("title", `%${searchQuery}%`)
      .order("title", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dbResults = (dbGames || []).map((game) => ({
      ...game,
      inDatabase: true,
    }));

    // If we have database results, return them (no need to search Steam)
    if (dbResults.length > 0) {
      return NextResponse.json({ db: dbResults, steam: [] });
    }

    // No database results, search Steam
    try {
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchQuery)}&cc=US&l=en`;
      const steamResponse = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (steamResponse.ok) {
        const steamData = (await steamResponse.json()) as SteamStoreSearchResponse;
        const items = Array.isArray(steamData.items) ? steamData.items : [];

        const steamResults = items
          .filter((item) => {
            const type = item.type?.toLowerCase() || "";
            const name = item.name?.toLowerCase() || "";
            return type !== "dlc" && !type.includes("dlc") && !name.includes("dlc");
          })
          .slice(0, 10)
          .map((item) => ({
            appid: item.id,
            title: item.name,
            header_image: item.tiny_image || item.small_image || null,
            inDatabase: false,
          }));

        return NextResponse.json({ db: [], steam: steamResults });
      }
    } catch (steamError) {
      console.error("Steam search error:", steamError);
      // Return empty Steam results if search fails
    }

    return NextResponse.json({ db: [], steam: [] });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Search error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
