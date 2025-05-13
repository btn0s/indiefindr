import { ImageResponse } from "next/og";
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
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1A202C", // Dark background
          color: "white",
          fontFamily: "sans-serif", // Using a common sans-serif font
          padding: "40px",
        }}
      >
        {/* Avatar or Initials */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${username}'s avatar`}
            width={160}
            height={160}
            style={{
              borderRadius: "50%",
              border: "4px solid #4A5568", // Slightly lighter border
              marginBottom: "30px",
            }}
          />
        ) : (
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              backgroundColor: "#4A5568", // Fallback background for initials
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "72px",
              fontWeight: "bold",
              color: "white",
              border: "4px solid #2D3748",
              marginBottom: "30px",
            }}
          >
            {initials}
          </div>
        )}

        {/* Username */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: "bold",
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          {username}
        </div>

        {/* Full Name (if available) */}
        {fullName && (
          <div
            style={{
              fontSize: "42px",
              color: "#A0AEC0",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {fullName}
          </div>
        )}

        {/* Badge with Finds Count */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "10px",
            marginBottom: "20px",
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
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {rank.title}
          </div>

          {/* Finds Count */}
          <div
            style={{
              fontSize: "36px",
              color: "#E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <strong>{findsCount}</strong>&nbsp;Game Discoveries
          </div>
        </div>

        {/* IndieFindr Branding */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            right: "40px",
            fontSize: "28px",
            color: "#718096",
          }}
        >
          IndieFindr
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
