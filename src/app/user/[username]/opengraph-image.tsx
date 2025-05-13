import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/db";
import { profilesTable, externalSourceTable, libraryTable } from "@/db/schema";
import { eq, count, desc, and, inArray } from "drizzle-orm";

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
  let gameImages: string[] = [];

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

      // Get images from games found by the user (up to 6 for 2 rows)
      const discoveredGames = await db
        .select({
          rawData: externalSourceTable.rawData,
        })
        .from(externalSourceTable)
        .where(eq(externalSourceTable.foundBy, profile.id))
        .orderBy(desc(externalSourceTable.lastFetched))
        .limit(6);

      gameImages = discoveredGames
        .filter(
          (game) =>
            game.rawData &&
            typeof game.rawData === "object" &&
            "header_image" in game.rawData
        )
        .map((game) => (game.rawData as any).header_image as string);
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
          backgroundColor: "#FFFFFF",
          color: "#09090B",
          fontFamily: "Geist, sans-serif",
          padding: "40px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${username}'s avatar`}
              width={120}
              height={120}
              style={{
                borderRadius: "50%",
                border: "4px solid #F1F5F9",
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: "#F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "48px",
                fontWeight: "600",
                color: "#64748B",
              }}
            >
              {initials}
            </div>
          )}

          {/* User Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "600",
                color: "#000000",
                lineHeight: "1.1",
              }}
            >
              {username}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  color: rank.color,
                  fontWeight: "500",
                }}
              >
                {rank.title}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  color: "#64748B",
                }}
              >
                •
              </span>
              <span
                style={{
                  fontSize: "24px",
                  color: "#64748B",
                }}
              >
                {findsCount} games found
              </span>
            </div>
          </div>

          {/* IndieFindr Logo */}
          <span
            style={{
              fontSize: "24px",
              fontWeight: "600",
              color: "#FFFFFF",
              backgroundColor: "#000000",
              padding: "12px 24px",
              borderRadius: "12px",
            }}
          >
            IndieFindr
          </span>
        </div>

        {/* Game Grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {gameImages.map((imageUrl, index) => (
            <img
              key={index}
              src={imageUrl}
              alt="Game Cover"
              style={{
                flex: 1,
                height: "200px",
                objectFit: "cover",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                minWidth: "300px",
              }}
            />
          ))}
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

