import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FacetType } from "@/lib/embeddings/types";

// Default weights for "all" facet mode
const DEFAULT_WEIGHTS = {
  aesthetic: 0.25,
  atmosphere: 0.25,
  mechanics: 0.25,
  narrative: 0.25,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  const { appid: appidStr } = await params;
  const appid = parseInt(appidStr, 10);

  if (isNaN(appid)) {
    return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const facet = searchParams.get("facet") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 24);
  const threshold = parseFloat(searchParams.get("threshold") || "0.5");

  const supabase = getSupabaseServerClient();

  try {
    let games;

    if (facet === "all") {
      // Use weighted multi-facet search
      const { data, error } = await supabase.rpc("find_similar_games_weighted", {
        p_appid: appid,
        p_weights: DEFAULT_WEIGHTS,
        p_limit: limit,
        p_threshold: threshold,
      });

      if (error) {
        console.error("Error fetching weighted similar games:", error);
        return NextResponse.json(
          { error: "Failed to fetch similar games" },
          { status: 500 }
        );
      }

      // Map from out_* column names to expected format
      games = (data || []).map((g: {
        out_appid: number;
        out_title: string;
        out_header_image: string | null;
        out_weighted_similarity: number;
      }) => ({
        appid: g.out_appid,
        title: g.out_title,
        header_image: g.out_header_image,
        similarity: g.out_weighted_similarity,
      }));
    } else {
      // Validate facet type
      const validFacets: FacetType[] = [
        "aesthetic",
        "atmosphere",
        "mechanics",
        "narrative",
        "dynamics",
      ];

      if (!validFacets.includes(facet as FacetType)) {
        return NextResponse.json({ error: "Invalid facet" }, { status: 400 });
      }

      // Use single-facet search
      const { data, error } = await supabase.rpc("find_similar_games", {
        p_appid: appid,
        p_facet: facet,
        p_limit: limit,
        p_threshold: threshold,
      });

      if (error) {
        console.error("Error fetching similar games:", error);
        return NextResponse.json(
          { error: "Failed to fetch similar games" },
          { status: 500 }
        );
      }

      // Map from out_* column names to expected format
      games = (data || []).map((g: {
        out_appid: number;
        out_title: string;
        out_header_image: string | null;
        out_similarity: number;
      }) => ({
        appid: g.out_appid,
        title: g.out_title,
        header_image: g.out_header_image,
        similarity: g.out_similarity,
      }));
    }

    return NextResponse.json({
      games,
      facet,
      count: games.length,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
