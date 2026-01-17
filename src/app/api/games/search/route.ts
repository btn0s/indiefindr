import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SearchGamesSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiDatabaseError,
  apiInternalError,
} from "@/lib/api/responses";
import { API_CONFIG } from "@/lib/config";
import { ZodError } from "zod";

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

type DbGameResult = {
  appid: number;
  title: string;
  header_image: string | null;
  rank?: number;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    const parseResult = SearchGamesSchema.safeParse({ q: query });
    if (!parseResult.success) {
      return apiSuccess({ db: [], steam: [] });
    }

    const searchQuery = parseResult.data.q.trim();

    const { data: ftsGames, error: ftsError } = await supabase.rpc(
      "search_games",
      { search_query: searchQuery, max_results: API_CONFIG.SEARCH_DB_LIMIT }
    );

    let dbGames: DbGameResult[] | null = ftsGames;
    let error = ftsError;

    if (ftsError || !ftsGames || ftsGames.length === 0) {
      const { data: ilikeGames, error: ilikeError } = await supabase
        .from("games_new")
        .select("appid, title, header_image")
        .ilike("title", `%${searchQuery}%`)
        .order("title", { ascending: true })
        .limit(API_CONFIG.SEARCH_DB_LIMIT);
      dbGames = ilikeGames;
      error = ilikeError;
    }

    if (error) {
      console.error("Search error:", error);
      return apiDatabaseError(error.message);
    }

    const dbResults = (dbGames || []).map((game: DbGameResult) => ({
      ...game,
      inDatabase: true,
    }));

    if (dbResults.length > 0) {
      return apiSuccess({ db: dbResults, steam: [] });
    }

    try {
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchQuery)}&cc=US&l=en`;
      const steamResponse = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (steamResponse.ok) {
        const steamData =
          (await steamResponse.json()) as SteamStoreSearchResponse;
        const items = Array.isArray(steamData.items) ? steamData.items : [];

        const steamResults = items
          .filter((item) => {
            const type = item.type?.toLowerCase() || "";
            const name = item.name?.toLowerCase() || "";
            return (
              type !== "dlc" &&
              !type.includes("dlc") &&
              !name.includes("dlc")
            );
          })
          .slice(0, API_CONFIG.SEARCH_STEAM_LIMIT)
          .map((item) => ({
            appid: item.id,
            title: item.name,
            header_image: item.tiny_image || item.small_image || null,
            inDatabase: false,
          }));

        return apiSuccess({ db: [], steam: steamResults });
      }
    } catch (steamError) {
      console.error("Steam search error:", steamError);
    }

    return apiSuccess({ db: [], steam: [] });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Search error:", errorMessage);
    return apiInternalError(errorMessage);
  }
}
