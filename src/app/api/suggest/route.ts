import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

/**
 * GET /api/suggest?game=PIGFACE
 * 
 * Search for community-suggested similar games using Perplexity
 */
export async function GET(request: NextRequest) {
  const gameName = request.nextUrl.searchParams.get("game");
  
  if (!gameName) {
    return NextResponse.json({ error: "game parameter required" }, { status: 400 });
  }

  try {
    console.log("[SUGGEST] Searching for games similar to:", gameName);
    
    const result = await generateText({
      model: "perplexity/sonar-pro",
      prompt: `Search Reddit, Steam forums, and gaming communities for what games players recommend as VISUALLY and AESTHETICALLY similar to "${gameName}".

Focus on games that LOOK similar - same art style, graphics fidelity, color palette, mood.

Return exactly 5 specific Steam game titles, one per line. Just the names, no explanations or numbers.`,
    });

    const suggestions = result.text
      .split("\n")
      .map(line => line.replace(/^\d+\.\s*/, "").trim())
      .filter(line => line.length > 0 && line.length < 100);

    console.log("[SUGGEST] Found suggestions:", suggestions);

    return NextResponse.json({
      game: gameName,
      suggestions,
    });
  } catch (error) {
    console.error("[SUGGEST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
