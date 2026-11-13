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

type DbGameResult = {
  appid: number;
  title: string;
  header_image: string | null;
  rank?: number;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
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

    let dbGames = ftsGames;
    let error = ftsError;

    if (ftsError || !ftsGames || ftsGames.length === 0) {
      const { data: ilikeGames, error: ilikeError } = await supabase
        .from("games")
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
