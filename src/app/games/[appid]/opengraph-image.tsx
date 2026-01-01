import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Suggestion } from "@/lib/supabase/types";

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

async function fetchImageAsDataUrl(url: string, timeoutMs = 1500): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "force-cache", signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function fallbackImage(title = "IndieFindr", subtitle = "Discover similar games") {
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
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: -1.2,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#bdbdbd", marginTop: 16, textAlign: "center" }}>
          {subtitle}
        </div>
      </div>
    ),
    { ...size }
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  try {
    const supabase = getSupabaseServerClient();
    const { appid } = await params;
    const appId = parseInt(appid, 10);

    if (isNaN(appId)) {
      return fallbackImage("IndieFindr", "Discover similar games");
    }

    // Fetch the main game and its suggestions
    const { data: gameData } = await supabase
      .from("games_new")
      .select("title, suggested_game_appids")
      .eq("appid", appId)
      .maybeSingle();

    if (!gameData?.title) {
      return fallbackImage("IndieFindr", "Discover similar games");
    }

    const suggestions: Suggestion[] = gameData.suggested_game_appids || [];
    const suggestedAppIds = suggestions.slice(0, 6).map((s) => s.appId);

    if (!suggestedAppIds.length) {
      return fallbackImage(`Games like ${gameData.title}`, "Discover similar games on IndieFindr");
    }

    // Resolve up to 6 cover images to data URLs, but fail fast (Discord/Slack scrapers time out easily).
    const coverDataUrls = await Promise.all(
      suggestedAppIds.map(async (id) => {
        const capsule = await fetchImageAsDataUrl(steamCapsuleUrl(id), 1200);
        if (capsule) return capsule;
        return fetchImageAsDataUrl(steamHeaderUrl(id), 1200);
      })
    );

    const title = `Games like ${gameData.title}`;
    const tiles = coverDataUrls.map((src, i) => (
      <div
        key={`${suggestedAppIds[i] ?? i}`}
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
              width: 3 * 350 + 2 * 16,
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
              6 related games
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
            {tiles}
          </div>
        </div>
      ),
      { ...size }
    );
  } catch {
    return fallbackImage("IndieFindr", "Discover similar games");
  }
}
