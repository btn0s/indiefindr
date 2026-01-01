import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Suggestion, GameNew } from "@/lib/supabase/types";

export const alt = "Game suggestions grid";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const supabase = getSupabaseServerClient();
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  // Fetch the main game and its suggestions
  const { data: gameData } = await supabase
    .from("games_new")
    .select("title, header_image, suggested_game_appids")
    .eq("appid", appId)
    .maybeSingle();

  if (!gameData) {
    // Fallback: simple text-based OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            color: "white",
          }}
        >
          <div style={{ display: "flex", fontSize: 48, fontWeight: "bold" }}>
            IndieFindr
          </div>
          <div
            style={{ display: "flex", fontSize: 24, color: "#888", marginTop: 16 }}
          >
            Discover similar games
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const suggestions: Suggestion[] = gameData.suggested_game_appids || [];
  const suggestedAppIds = suggestions.slice(0, 6).map((s) => s.appId);

  // Fetch suggested games' header images
  let suggestedGames: Pick<GameNew, "appid" | "header_image" | "title">[] = [];
  if (suggestedAppIds.length > 0) {
    const { data: games } = await supabase
      .from("games_new")
      .select("appid, header_image, title")
      .in("appid", suggestedAppIds);
    suggestedGames = (games || []).filter((g) => g.header_image);
  }

  // Sort by original suggestion order
  const sortedGames = suggestedAppIds
    .map((id) => suggestedGames.find((g) => g.appid === id))
    .filter((g): g is (typeof suggestedGames)[0] => g !== undefined)
    .slice(0, 6);

  // Steam header image aspect ratio: 460/215
  const imageWidth = 386;
  const imageHeight = Math.round(imageWidth * (215 / 460));

  // Build grid items - each must have explicit display: flex
  const gridItems = sortedGames.map((game) => (
    <div
      key={game.appid}
      style={{
        width: imageWidth,
        height: imageHeight,
        display: "flex",
        overflow: "hidden",
      }}
    >
      <img
        src={game.header_image!}
        alt={game.title}
        width={imageWidth}
        height={imageHeight}
        style={{
          objectFit: "cover",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  ));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          gap: 12,
          backgroundColor: "#0a0a0a",
          padding: 20,
        }}
      >
        {sortedGames.length > 0 ? (
          gridItems
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: 24,
            }}
          >
            Discover similar games
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
