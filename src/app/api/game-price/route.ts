import { NextResponse } from "next/server";
import { URLSearchParams } from "url"; // Use Node.js URLSearchParams

// Ensure RapidAPI key is loaded from environment variables
const rapidApiKey = process.env.RAPIDAPI_KEY;
const rapidApiHost = "games-details.p.rapidapi.com";

export async function GET(request: Request) {
  if (!rapidApiKey) {
    console.error("RAPID_API_KEY is not set.");
    return NextResponse.json(
      { error: "API key configuration error." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const gameName = searchParams.get("gameName");

  if (!gameName) {
    return NextResponse.json(
      { error: "Missing required query parameter: gameName" },
      { status: 400 }
    );
  }

  const searchQuery = `sugg=${encodeURIComponent(gameName || "")}`;
  const searchUrl = `https://games-details.p.rapidapi.com/search?${searchQuery}`;

  console.log("searchUrl", searchUrl);

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
      // Add caching strategy if desired, e.g., revalidate every hour
      // next: { revalidate: 3600 }
    });

    if (!response.ok) {
      console.error(`RapidAPI Error (${searchUrl}): ${response.status}`);
      return NextResponse.json(
        {
          error: `Failed to fetch data from external API (${response.status})`,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log("result", result);

    let foundPrice: string | null = null;
    const searchResults = result?.data?.search;

    console.log("searchResults", searchResults);

    if (Array.isArray(searchResults) && searchResults.length > 0) {
      const targetName = gameName?.toLowerCase();

      const foundGame = searchResults.find(
        (game) => targetName && game.name?.toLowerCase() === targetName
      );

      console.log("foundGame", foundGame);

      if (
        foundGame &&
        typeof foundGame.price === "string" &&
        foundGame.price.trim() !== ""
      ) {
        foundPrice = foundGame.price;
      }
    }

    return NextResponse.json({ price: foundPrice });
  } catch (error) {
    console.error("Error in /api/game-price:", error);
    return NextResponse.json(
      { error: "Internal server error fetching game price." },
      { status: 500 }
    );
  }
}
