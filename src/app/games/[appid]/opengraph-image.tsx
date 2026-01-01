import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Suggestion, GameNew } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 hour

export const alt = "Games like this — IndieFindr";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function steamCapsuleUrl(appid: number) {
  // "Cover"/capsule art (great for a 2x3 grid).
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`;
}

function steamHeaderUrl(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

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

  // Fetch suggested games for fallback header images (not required, but helps if capsule art is missing).
  let suggestedGames: Pick<GameNew, "appid" | "header_image" | "title">[] = [];
  if (suggestedAppIds.length > 0) {
    const { data: games } = await supabase
      .from("games_new")
      .select("appid, header_image, title")
      .in("appid", suggestedAppIds);
    suggestedGames = games || [];
  }

  const sortedGames = suggestedAppIds
    .map((id) => suggestedGames.find((g) => g.appid === id) || { appid: id, header_image: null, title: "" })
    .slice(0, 6);

  // Resolve up to 6 cover images to data URLs (avoid render failures when remote images 404).
  const coverDataUrls = await Promise.all(
    sortedGames.map(async (g) => {
      const capsule = await fetchImageAsDataUrl(steamCapsuleUrl(g.appid));
      if (capsule) return capsule;

      // Fallback 1: DB-provided header image (Steam store URL)
      if (g.header_image) {
        const headerFromDb = await fetchImageAsDataUrl(g.header_image);
        if (headerFromDb) return headerFromDb;
      }

      // Fallback 2: Steam CDN header.jpg
      return fetchImageAsDataUrl(steamHeaderUrl(g.appid));
    })
  );

  const title = `Games like ${gameData.title}`;
  const tiles = coverDataUrls.map((src, i) => (
    <div
      key={`${sortedGames[i]?.appid ?? i}`}
      style={{
        width: 350,
        height: 200,
        display: "flex",
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#151515",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={350}
          height={200}
          style={{
            objectFit: "cover",
            width: "100%",
            height: "100%",
            display: "flex",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b6b6b",
            fontSize: 18,
          }}
        >
          IndieFindr
        </div>
      )}
    </div>
  ));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(1200px 630px at 20% 0%, rgba(255,255,255,0.08), rgba(0,0,0,0)), radial-gradient(900px 500px at 100% 40%, rgba(124,58,237,0.16), rgba(0,0,0,0))",
          padding: "52px 56px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", fontSize: 20, color: "#bdbdbd", letterSpacing: -0.2 }}>
            IndieFindr
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 800,
              color: "white",
              letterSpacing: -1.2,
              lineHeight: 1.05,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#bdbdbd" }}>
            Discover 6 related indie games
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            width: 3 * 350 + 2 * 16,
            justifyContent: "center",
          }}
        >
          {tiles.length ? (
            tiles
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#bdbdbd",
                fontSize: 24,
              }}
            >
              Discover similar games on IndieFindr
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
