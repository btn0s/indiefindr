import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 hour

export const alt = "IndieFindr — Discover similar games";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function steamCapsuleUrl(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`;
}

function steamHeaderUrl(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

async function fetchImageAsDataUrl(
  url: string,
  timeoutMs = 1500
): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "force-cache", signal: controller.signal });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function placeholderGridImage() {
  const tile = (key: string) => (
    <div
      key={key}
      style={{
        width: 350,
        height: 200,
        display: "flex",
        borderRadius: 0,
        overflow: "hidden",
        backgroundColor: "#151515",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    />
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
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
            flexWrap: "wrap",
            gap: 16,
            width: 3 * 350 + 2 * 16,
            justifyContent: "center",
          }}
        >
          {tile("1")}
          {tile("2")}
          {tile("3")}
          {tile("4")}
          {tile("5")}
          {tile("6")}
        </div>
      </div>
    ),
    { ...size }
  );
}

type Row = {
  appid: number;
  suggested_game_appids: unknown;
  created_at: string;
};

export default async function Image() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new")
    .select("appid, suggested_game_appids, created_at")
    .limit(60);

  if (error) return placeholderGridImage();

  const games = (data || []) as Row[];
  const sorted = games.sort((a, b) => {
    const aCount = Array.isArray(a.suggested_game_appids)
      ? a.suggested_game_appids.length
      : 0;
    const bCount = Array.isArray(b.suggested_game_appids)
      ? b.suggested_game_appids.length
      : 0;

    if (bCount !== aCount) return bCount - aCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const appIds = sorted.slice(0, 6).map((g) => g.appid).filter(Boolean);
  if (appIds.length === 0) return placeholderGridImage();

  const coverDataUrls = await Promise.all(
    appIds.map(async (id) => {
      const capsule = await fetchImageAsDataUrl(steamCapsuleUrl(id), 1200);
      if (capsule) return capsule;
      return fetchImageAsDataUrl(steamHeaderUrl(id), 1200);
    })
  );

  const tiles = coverDataUrls.map((src, i) => (
    <div
      key={`${appIds[i] ?? i}`}
      style={{
        width: 350,
        height: 200,
        display: "flex",
        borderRadius: 0,
        overflow: "hidden",
        backgroundColor: "#151515",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.06)",
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
        <div style={{ display: "flex", width: "100%", height: "100%" }} />
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
}

