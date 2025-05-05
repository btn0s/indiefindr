import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ steamAppId: string }> }
) {
  const steamAppId = (await params).steamAppId;
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!steamAppId) {
    return NextResponse.json(
      { error: "Steam App ID is required" },
      { status: 400 }
    );
  }

  if (!apiKey) {
    console.error("RAPID_API_KEY environment variable is not set.");
    return NextResponse.json(
      { error: "Internal Server Error: API key not configured." },
      { status: 500 }
    );
  }

  const url = `https://games-details.p.rapidapi.com/news/all/${steamAppId}?limit=5&offset=0`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "games-details.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
      // Optional: Add caching strategy if desired
      // next: { revalidate: 3600 } // Revalidate every hour
    });

    if (!response.ok) {
      // Log the error from RapidAPI for debugging
      const errorBody = await response.text();
      console.error(`RapidAPI Error (${response.status}): ${errorBody}`);
      return NextResponse.json(
        {
          error: `Failed to fetch news from external API. Status: ${response.status}`,
        },
        { status: response.status } // Forward the status code
      );
    }

    const data = await response.json();

    // Return the relevant part of the data
    return NextResponse.json(data?.data?.news || []);
  } catch (error) {
    console.error("Failed to fetch game news:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
