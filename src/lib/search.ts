import { API_CONFIG } from "./config";
import { getSupabaseServerClient } from "./supabase/server";

/** One catalog title search for the search box, /api/search, MCP and the CLI. Matching and ranking live in the search_games SQL function. */
export type SearchResult = {
  appid: number;
  title: string;
  header_image: string | null;
  release_date: string | null;
  review_count: number;
  review_positive_pct: number | null;
};

export async function searchGames(query: string, limit: number = API_CONFIG.SEARCH_LIMIT): Promise<SearchResult[]> {
  const { data, error } = await getSupabaseServerClient()
    .rpc("search_games", { search_query: query.trim().slice(0, 200), max_results: limit });
  if (error) throw new Error("Search unavailable. Retry shortly or use a Steam appid.");
  return (data ?? []) as SearchResult[];
}
