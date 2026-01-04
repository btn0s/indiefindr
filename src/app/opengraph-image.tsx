import { ImageResponse } from "next/og";

// Keep the homepage OG image extremely fast/reliable for social crawlers:
// - No DB calls
// - No remote image fetches
// - Edge runtime (avoids serverless cold-start)
export const runtime = "edge";
export const revalidate = 2592000; // 30 days

export const alt = "IndieFindr — Discover similar games";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Tile({
  keyId,
  accent,
}: {
  keyId: string;
  accent: "purple" | "cyan" | "amber";
}) {
  const accentMap = {
    purple: "rgba(124,58,237,0.55)",
    cyan: "rgba(34,211,238,0.45)",
    amber: "rgba(251,191,36,0.40)",
  } as const;

  return (
    <div
      key={keyId}
      style={{
        width: 350,
        height: 200,
        display: "flex",
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0f0f10",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 14px 50px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(800px 340px at 15% 25%, ${accentMap[accent]}, rgba(0,0,0,0)), radial-gradient(700px 380px at 100% 75%, rgba(255,255,255,0.08), rgba(0,0,0,0))`,
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.00) 45%), linear-gradient(0deg, rgba(0,0,0,0.70), rgba(0,0,0,0.00) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 20,
          bottom: 18,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 650,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: -0.2,
          }}
        >
          Find games like your favorites
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.68)",
            letterSpacing: 0.2,
          }}
        >
          Steam • Indie • Recommendations + explanations
        </div>
      </div>
    </div>
  );
}

export default async function Image() {
  const image = new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#070708",
          backgroundImage:
            "radial-gradient(1200px 630px at 0% 0%, rgba(124,58,237,0.18), rgba(0,0,0,0)), radial-gradient(900px 500px at 100% 30%, rgba(34,211,238,0.14), rgba(0,0,0,0)), radial-gradient(700px 500px at 60% 110%, rgba(251,191,36,0.08), rgba(0,0,0,0))",
          padding: "54px 60px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 80,
                fontWeight: 800,
                letterSpacing: -2,
                color: "white",
                lineHeight: 1,
              }}
            >
              IndieFindr
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 500,
                letterSpacing: -0.8,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              Discover similar games in seconds
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              width: 3 * 350 + 2 * 18,
              justifyContent: "center",
              alignSelf: "center",
            }}
          >
            <Tile keyId="1" accent="purple" />
            <Tile keyId="2" accent="cyan" />
            <Tile keyId="3" accent="amber" />
            <Tile keyId="4" accent="cyan" />
            <Tile keyId="5" accent="amber" />
            <Tile keyId="6" accent="purple" />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.70)",
                letterSpacing: 0.4,
              }}
            >
              indiefindr.gg
            </div>
            <div
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.52)",
              }}
            >
              AI-powered recommendations with explanations
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );

  // Ensure crawlers (and CDNs like Vercel) can cache this aggressively.
  image.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=2592000, stale-while-revalidate=86400"
  );

  return image;
}

