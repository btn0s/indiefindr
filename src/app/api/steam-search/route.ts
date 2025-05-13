import { NextResponse } from "next/server";

// Define the structure of the game data to return for search results
interface SteamSearchResult {
  appid: number;
  name: string;
  icon: string;
  logo: string;
}

interface SteamSearchResponse {
  results: SteamSearchResult[];
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  console.log(`[API /steam-search] Received search query: "${query}"`);

  try {
    // Use the Steam Store API to search for games
    // Note: This is using the public Steam Store search API
    const steamSearchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      query
    )}&l=english&cc=US`;

    const response = await fetch(steamSearchUrl);
    
    if (!response.ok) {
      throw new Error(`Steam API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      return NextResponse.json({ results: [] });
    }

    // Format the results to match our expected structure
    const formattedResults: SteamSearchResult[] = data.items
      .filter((item: any) => item.type === "app") // Only include apps (games)
      .map((item: any) => ({
        appid: item.id,
        name: item.name,
        icon: item.tiny_image,
        logo: item.logo,
      }));

    console.log(
      `[API /steam-search] Found ${formattedResults.length} results for query "${query}".`
    );

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error(
      `[API /steam-search] Error during search for query "${query}":`,
      error
    );
    return NextResponse.json(
      { error: "Internal server error during search.", details: error.message },
      { status: 500 }
    );
  }
}

