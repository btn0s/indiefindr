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

    const searchParams = request.nextUrl.searchParams;
    const facet = searchParams.get("facet") || "all";
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const threshold = parseFloat(searchParams.get("threshold") || "0.7");

    const facets = ["aesthetic", "gameplay", "narrative"];
    const requestedFacets =
      facet === "all" ? facets : [facet].filter((f) => facets.includes(f));

    // Fetch related games for each requested facet
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

    return NextResponse.json(results);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
