import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/db";
import { profilesTable, externalSourceTable } from "@/db/schema";
import { eq, count } from "drizzle-orm";

// Config for the image
// Edge runtime removed to use Node.js runtime
export const alt = "User Profile on IndieFindr";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Helper to get initials
const getOgUserInitials = (name?: string | null) => {
  if (!name) return "";
  const names = name.split(" ");
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

// Helper to determine rank based on finds count
const getRankInfo = (findsCount: number) => {
  if (findsCount >= 100) return { title: "Game Hunter", color: "#9F7AEA" }; // Purple
  if (findsCount >= 50) return { title: "Game Explorer", color: "#4299E1" }; // Blue
  if (findsCount >= 20) return { title: "Game Scout", color: "#48BB78" }; // Green
  if (findsCount >= 5) return { title: "Game Seeker", color: "#ECC94B" }; // Yellow
  return { title: "Game Finder", color: "#F56565" }; // Red
};

export default async function Image({
  params,
}: {
  params: { username: string };
}) {
  // Load the font files from src/assets/fonts
  const geistRegular = await readFile(
    join(process.cwd(), "src/assets/fonts/Geist/ttf/Geist-Regular.ttf")
  );
  const geistMedium = await readFile(
    join(process.cwd(), "src/assets/fonts/Geist/ttf/Geist-Medium.ttf")
  );
  const geistSemiBold = await readFile(
    join(process.cwd(), "src/assets/fonts/Geist/ttf/Geist-SemiBold.ttf")
  );
  const geistBold = await readFile(
    join(process.cwd(), "src/assets/fonts/Geist/ttf/Geist-Bold.ttf")
  );

  const decodedUsername = decodeURIComponent(params.username);
  let profile = null;
  let findsCount = 0;

  try {
    // Fetch user profile data directly from the database, just like in page.tsx
    const profileResult = await db
      .select({
        id: profilesTable.id,
        username: profilesTable.username,
        avatarUrl: profilesTable.avatarUrl,
        fullName: profilesTable.fullName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.username, decodedUsername))
      .limit(1);

    if (profileResult.length > 0) {
      profile = profileResult[0];

      // Count the games found by this user
      const findsResult = await db
        .select({
          count: count(),
        })
        .from(externalSourceTable)
        .where(eq(externalSourceTable.foundBy, profile.id));

      if (findsResult.length > 0) {
        findsCount = Number(findsResult[0].count) || 0;
      }
    }
  } catch (error) {
    console.error(
      `OG Image: Failed to fetch profile for ${decodedUsername}:`,
      error
    );
    // We can still return a default image if the profile isn't found or an error occurs
  }

  const username = profile?.username || "User Profile";
  const fullName = profile?.fullName || null;
  const avatarUrl = profile?.avatarUrl || null;
  const initials = getOgUserInitials(fullName || username);
  const rank = getRankInfo(findsCount);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FFFFFF", // Light background like card
          color: "#09090B", // Dark text like card
          fontFamily: "Geist, sans-serif",
          padding: "48px",
        }}
      >
        {/* Header with logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#000000",
            }}
          >
            IndieFindr
          </div>
        </div>

        {/* Profile Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            flex: "1",
            gap: "48px",
          }}
        >
          {/* Avatar Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "24px",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${username}'s avatar`}
                width={180}
                height={180}
                style={{
                  borderRadius: "50%",
                  border: "4px solid #E2E8F0",
                }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  backgroundColor: "#E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "72px",
                  fontWeight: "bold",
                  color: "#64748B",
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Info Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: "1",
            }}
          >
            <div
              style={{
                fontSize: "64px",
                fontWeight: "600",
                marginBottom: "16px",
                color: "#000000",
              }}
            >
              {username}
            </div>

            {fullName && (
              <div
                style={{
                  fontSize: "32px",
                  color: "#64748B", // Muted foreground
                  marginBottom: "24px",
                }}
              >
                {fullName}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: "16px",
                gap: "16px",
              }}
            >
              {/* Rank Badge */}
              <div
                style={{
                  backgroundColor: rank.color,
                  paddingLeft: "16px",
                  paddingRight: "16px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  borderRadius: "9999px",
                  fontSize: "20px",
                  fontWeight: "500",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {rank.title}
              </div>

              {/* Discoveries Counter */}
              <div
                style={{
                  fontSize: "20px",
                  color: "#64748B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <strong style={{ marginRight: "4px", color: "#1E293B" }}>
                  {findsCount}
                </strong>
                &nbsp;Games Discovered
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
            marginTop: "48px",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              color: "#94A3B8", // Very muted foreground for footer
            }}
          >
            Discover indie games you'll love at indiefindr.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geistRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Geist",
          data: geistMedium,
          style: "normal",
          weight: 500,
        },
        {
          name: "Geist",
          data: geistSemiBold,
          style: "normal",
          weight: 600,
        },
        {
          name: "Geist",
          data: geistBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
