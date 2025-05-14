import { NextResponse } from "next/server";
import { searchSteam, type SteamSearchResult } from "@/lib/steam-search"; // Import the new function and type

// The SteamSearchResult interface can be removed from here if preferred, as it's imported,
// or kept if it's also used for defining SteamSearchResponse specifically in this file.
// For this refactor, let's assume it's primarily defined and exported from steam-search.ts.

// interface SteamSearchResult { // Already imported
//   appid: number;
//   name: string;
//   icon: string;
//   logo: string;
// }

interface SteamSearchResponse {
  // This can remain if the API response structure is distinct
  results: SteamSearchResult[];
  error?: string;
  details?: string; // Added to match the return type of searchSteam
}

/**
 * Steam search API endpoint
 *
 * TODO: Future improvements:
 * - Add rate limiting to prevent abuse
 * - Implement caching to reduce API calls to Steam (or handle in searchSteam lib)
 * - Add pagination for large result sets (or handle in searchSteam lib)
 * - Consider using the official Steam Web API with an API key for more reliable access
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { results: [], error: "Search query is required" }, // Ensure results is an empty array
      { status: 400 }
    );
  }

  console.log(`[API /steam-search] Received search query: "${query}"`);

  // Call the library function
  const searchResult = await searchSteam(query);

  if (searchResult.error) {
    return NextResponse.json(
      searchResult, // Pass the whole object which includes error and details
      { status: searchResult.error === "Search query is required" ? 400 : 500 } // More specific status
    );
  }

  return NextResponse.json({ results: searchResult.results });
}
