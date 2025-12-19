import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

/**
 * Find games by name (fuzzy search)
 * GET /api/diagnose/find?name=Pig Face
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Name parameter is required" },
        { status: 400 }
      );
    }

    const { data: games, error } = await supabase
      .from("games")
      .select(
        "id, name, aesthetic_text, gameplay_text, narrative_text, aesthetic_embedding, gameplay_embedding, narrative_embedding"
      )
      .ilike("name", `%${name}%`)
      .order("name", { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: `Failed to search games: ${error.message}` },
        { status: 500 }
      );
    }

    const results = (games || []).map((game) => ({
      id: game.id,
      name: game.name,
      hasAestheticEmbedding: !!game.aesthetic_embedding,
      hasGameplayEmbedding: !!game.gameplay_embedding,
      hasNarrativeEmbedding: !!game.narrative_embedding,
      aestheticDescriptors: game.aesthetic_text
        ?.split(",")
        .map((d) => d.trim())
        .filter(Boolean) || [],
      gameplayDescriptors: game.gameplay_text
        ?.split(",")
        .map((d) => d.trim())
        .filter(Boolean) || [],
      narrativeDescriptors: game.narrative_text
        ?.split(",")
        .map((d) => d.trim())
        .filter(Boolean) || [],
    }));

    return NextResponse.json({
      query: name,
      count: results.length,
      games: results,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
