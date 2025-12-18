import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const { appid } = await params;
    const appId = parseInt(appid, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: "Invalid app ID" }, { status: 400 });
    }

    // Check which facets have embeddings
    const { data: game } = await supabase
      .from("games")
      .select("aesthetic_embedding, gameplay_embedding, narrative_embedding")
      .eq("id", appId)
      .single();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Determine which facets have embeddings
    const availableFacets = [
      game.aesthetic_embedding !== null && "aesthetic",
      game.gameplay_embedding !== null && "gameplay",
      game.narrative_embedding !== null && "narrative",
    ].filter(Boolean) as string[];

    const hasEmbeddings = availableFacets.length > 0;

    if (!hasEmbeddings) {
      return NextResponse.json({
        hasEmbeddings: false,
        relatedGames: null,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const facet = searchParams.get("facet") || "all";
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const threshold = parseFloat(searchParams.get("threshold") || "0.55");

    const allFacets = ["aesthetic", "gameplay", "narrative"];
    const requestedFacets =
      facet === "all"
        ? availableFacets // Only search facets that have embeddings
        : [facet].filter((f) => allFacets.includes(f) && availableFacets.includes(f));

    // Fetch related games for each requested facet that has embeddings
    const results: Record<string, any[]> = {};

    for (const facetName of requestedFacets) {
      const { data, error } = await supabase.rpc("get_related_games", {
        p_appid: appId,
        p_facet: facetName,
        p_limit: limit,
        p_threshold: threshold,
      });

      if (error) {
        console.error(`Error fetching ${facetName} similar games:`, error);
        results[facetName] = [];
      } else {
        results[facetName] = data || [];
      }
    }

    return NextResponse.json({
      hasEmbeddings: true,
      relatedGames: {
        aesthetic: results.aesthetic || [],
        gameplay: results.gameplay || [],
        narrative: results.narrative || [],
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
