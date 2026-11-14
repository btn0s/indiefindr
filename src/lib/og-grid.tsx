import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
// Tiles keep Steam's 460:215 header shape, so titles printed on the art are never cropped. Shared with scripts/generate-home-og.ts.
const TILE_W = 360;
const TILE_H = 168;
const GAP = 16;

async function fetchImageAsDataUrl(url: string, timeoutMs: number): Promise<string | null> {
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

/** The IndieFindr share image: a 3x2 grid of the games' stored header images. Missing images render as dark tiles. */
export async function gameGridImage(headerImages: (string | null)[]) {
  const urls = Array.from({ length: 6 }, (_, i) => headerImages[i] ?? null);
  const coverDataUrls = await Promise.all(urls.map(url => url ? fetchImageAsDataUrl(url, 3000) : null));
  const tiles = coverDataUrls.map((src, i) => (
    <div
      key={i}
      style={{
        width: TILE_W,
        height: TILE_H,
        display: "flex",
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#151517",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
        <img
          src={src}
          alt=""
          width={TILE_W}
          height={TILE_H}
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
            flexWrap: "wrap",
            gap: GAP,
            width: 3 * TILE_W + 2 * GAP,
            justifyContent: "center",
          }}
        >
          {tiles}
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
