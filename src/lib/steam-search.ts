// src/lib/steam-search.ts

// Define the structure of the game data to return for search results
export interface SteamSearchResult {
  appid: number;
  name: string;
  icon: string; // Corresponds to 'tiny_image' from Steam API (e.g., capsule_231x87.jpg)
  // logo: string; // This field is not available in the storesearch API response
}

/**
 * Searches the Steam Store API for games.
 *
 * @param query The search term.
 * @returns A promise that resolves to an object containing results or an error message.
 */
export async function searchSteam(query: string): Promise<{
  results: SteamSearchResult[];
  error?: string;
  details?: string;
}> {
  if (!query || query.trim() === "") {
    return { results: [], error: "Search query is required" };
  }

  console.log(`[Steam Search Lib] Searching Steam for: "${query}"`);

  try {
    const steamSearchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      query
    )}&l=english&cc=US`;

    const response = await fetch(steamSearchUrl);

    if (!response.ok) {
      console.error(
        `[Steam Search Lib] Steam API request failed for query "${query}" with status ${response.status}`
      );
      return {
        results: [],
        error: `Steam API request failed with status ${response.status}`,
      };
    }

    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      console.log(
        `[Steam Search Lib] No items found or invalid format for query "${query}". Data:`,
        data
      );
      return { results: [] }; // Return empty results if no items array
    }

    const formattedResults: SteamSearchResult[] = data.items
      .filter((item: any) => item.type === "app") // Only include apps (games)
      .map((item: any) => ({
        appid: item.id,
        name: item.name,
        icon: item.tiny_image, // tiny_image is the small capsule image
        // logo: item.logo, // item.logo is not available from this API endpoint
      }));

    console.log(
      `[Steam Search Lib] Found ${formattedResults.length} results on Steam for query "${query}".`
    );
    return { results: formattedResults };
  } catch (error: any) {
    console.error(
      `[Steam Search Lib] Error during Steam search for query "${query}":`,
      error
    );
    return {
      results: [],
      error: "Internal server error during Steam search.",
      details: error.message,
    };
  }
}
