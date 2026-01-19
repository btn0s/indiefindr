import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FacetType } from "@/lib/embeddings/types";

const VALID_FACETS: FacetType[] = [
  "aesthetic",
  "atmosphere",
  "mechanics",
  "narrative",
  "dynamics",
];

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
  const facet = (searchParams.get("facet") || "aesthetic") as FacetType;
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 24);
  const threshold = parseFloat(searchParams.get("threshold") || "0.5");

  if (!VALID_FACETS.includes(facet)) {
    return NextResponse.json({ error: "Invalid facet" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  try {
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

    const games = (data || []).map((g: {
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
