import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

/**
 * Find games with similar descriptor words
 * GET /api/diagnose/similar-descriptors?facet=aesthetic&limit=20&minShared=2
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const facet = searchParams.get("facet") || "aesthetic";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const minShared = parseInt(searchParams.get("minShared") || "2", 10);

    if (!["aesthetic", "gameplay", "narrative"].includes(facet)) {
      return NextResponse.json(
        { error: "Facet must be one of: aesthetic, gameplay, narrative" },
        { status: 400 }
      );
    }

    const facetColumn = `${facet}_text`;

    // Get all games with descriptors
    const { data: games, error } = await supabase
      .from("games")
      .select(`id, name, ${facetColumn}`)
      .not(facetColumn, "is", null)
      .neq(facetColumn, "");

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch games: ${error.message}` },
        { status: 500 }
      );
    }

    // Build descriptor index
    const descriptorMap = new Map<string, Set<number>>();

    (games || []).forEach((game) => {
      const descriptors = (game[facetColumn] as string)
        ?.split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean) || [];

      descriptors.forEach((desc) => {
        if (!descriptorMap.has(desc)) {
          descriptorMap.set(desc, new Set());
        }
        descriptorMap.get(desc)!.add(game.id);
      });
    });

    // Find pairs with shared descriptors
    const pairs = new Map<string, { game1: any; game2: any; shared: string[] }>();

    (games || []).forEach((game1) => {
      (games || []).forEach((game2) => {
        if (game1.id >= game2.id) return; // Avoid duplicates

        const desc1 = new Set(
          (game1[facetColumn] as string)
            ?.split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean) || []
        );
        const desc2 = new Set(
          (game2[facetColumn] as string)
            ?.split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean) || []
        );

        const shared = Array.from(desc1).filter((d) => desc2.has(d));

        if (shared.length >= minShared) {
          const key = `${game1.id}-${game2.id}`;
          pairs.set(key, {
            game1: { id: game1.id, name: game1.name },
            game2: { id: game2.id, name: game2.name },
            shared: shared.sort(),
          });
        }
      });
    });

    // Sort by shared count
    const results = Array.from(pairs.values())
      .sort((a, b) => b.shared.length - a.shared.length)
      .slice(0, limit)
      .map((pair) => ({
        game1: pair.game1,
        game2: pair.game2,
        sharedDescriptors: pair.shared,
        sharedCount: pair.shared.length,
      }));

    return NextResponse.json({
      facet,
      minShared,
      count: results.length,
      pairs: results,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
