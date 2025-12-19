import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

/**
 * Compare two games to see why they're not matching
 * GET /api/diagnose/compare?game1Id=123&game2Id=456&facet=aesthetic
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const game1Id = searchParams.get("game1Id");
    const game2Id = searchParams.get("game2Id");
    const facet = searchParams.get("facet") || "aesthetic";

    if (!game1Id || !game2Id) {
      return NextResponse.json(
        { error: "Both game1Id and game2Id are required" },
        { status: 400 }
      );
    }

    const game1IdNum = parseInt(game1Id, 10);
    const game2IdNum = parseInt(game2Id, 10);

    if (isNaN(game1IdNum) || isNaN(game2IdNum)) {
      return NextResponse.json(
        { error: "Invalid game IDs" },
        { status: 400 }
      );
    }

    if (!["aesthetic", "gameplay", "narrative"].includes(facet)) {
      return NextResponse.json(
        { error: "Facet must be one of: aesthetic, gameplay, narrative" },
        { status: 400 }
      );
    }

    const facetColumn = `${facet}_text`;
    const embeddingColumn = `${facet}_embedding`;

    // Get both games
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select(`id, name, ${facetColumn}, ${embeddingColumn}`)
      .in("id", [game1IdNum, game2IdNum]);

    if (gamesError) {
      return NextResponse.json(
        { error: `Failed to fetch games: ${gamesError.message}` },
        { status: 500 }
      );
    }

    if (!games || games.length !== 2) {
      return NextResponse.json(
        { error: "One or both games not found" },
        { status: 404 }
      );
    }

    const game1 = games.find((g) => g.id === game1IdNum);
    const game2 = games.find((g) => g.id === game2IdNum);

    if (!game1 || !game2) {
      return NextResponse.json(
        { error: "Games not found" },
        { status: 404 }
      );
    }

    // Calculate similarity using the get_related_games RPC function
    let similarityScore: number | null = null;
    let matchStatus: string | null = null;

    if (game1[embeddingColumn] && game2[embeddingColumn]) {
      // Use get_related_games with a very low threshold to get similarity score
      // even if it's below the normal threshold
      const { data: relatedData } = await supabase.rpc("get_related_games", {
        p_appid: game1IdNum,
        p_facet: facet,
        p_limit: 1000,
        p_threshold: 0.0, // Very low threshold to get all games including low similarity
      });

      const match = relatedData?.find((g: any) => g.appid === game2IdNum);
      if (match) {
        similarityScore = match.similarity;
        // Use facet-specific thresholds
        const threshold = facet === "aesthetic" ? 0.75 : 0.55;
        if (similarityScore >= threshold) {
          matchStatus = `WOULD MATCH (threshold ${threshold})`;
        } else {
          matchStatus = "BELOW THRESHOLD";
        }
      } else if (relatedData) {
        // Game 2 exists but similarity wasn't returned (might be NULL embeddings)
        matchStatus = "CANNOT CALCULATE (check embeddings)";
      }
    }

    // Parse descriptors
    const game1Descriptors = (game1[facetColumn] as string | null)
      ?.split(",")
      .map((d) => d.trim())
      .filter(Boolean) || [];
    const game2Descriptors = (game2[facetColumn] as string | null)
      ?.split(",")
      .map((d) => d.trim())
      .filter(Boolean) || [];

    // Find shared and unique descriptors
    const game1Lower = game1Descriptors.map((d) => d.toLowerCase());
    const game2Lower = game2Descriptors.map((d) => d.toLowerCase());

    const sharedDescriptors = game1Descriptors.filter((d, i) =>
      game2Lower.includes(game1Lower[i])
    );
    const onlyInGame1 = game1Descriptors.filter(
      (d, i) => !game2Lower.includes(game1Lower[i])
    );
    const onlyInGame2 = game2Descriptors.filter(
      (d, i) => !game1Lower.includes(game2Lower[i])
    );

    return NextResponse.json({
      game1: {
        id: game1.id,
        name: game1.name,
        descriptors: game1Descriptors,
        hasEmbedding: !!game1[embeddingColumn],
      },
      game2: {
        id: game2.id,
        name: game2.name,
        descriptors: game2Descriptors,
        hasEmbedding: !!game2[embeddingColumn],
      },
      comparison: {
        facet,
        similarityScore,
        matchStatus,
        sharedDescriptors,
        onlyInGame1,
        onlyInGame2,
        sharedCount: sharedDescriptors.length,
        totalGame1Descriptors: game1Descriptors.length,
        totalGame2Descriptors: game2Descriptors.length,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
