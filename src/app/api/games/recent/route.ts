import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db"; // Assuming db instance is exported from @/db
import { externalSourceTable, profilesTable } from "@/db/schema"; // Ensure profilesTable is imported
import { desc, eq } from "drizzle-orm"; // Import eq for join condition
import type { SteamRawData } from "@/types/steam";

// Consistent type from feed-display.tsx ApiGame
interface RecentApiGame {
  id: number;
  title: string | null;
  shortDescription: string | null;
  steamAppid: string | null;
  tags: string[] | null;
  rawData?: SteamRawData | null;
}

interface RecentGamesResult {
  success: boolean;
  data?: RecentApiGame[];
  message?: string;
}

const DEFAULT_LIMIT = 4; // Default number of games per page

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(
    searchParams.get("limit") || String(DEFAULT_LIMIT),
    10
  );

  // Validate page and limit
  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, Math.min(50, limit)); // Add a max limit for safety
  const offset = (pageNum - 1) * limitNum;

  try {
    const recentGames = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        shortDescription: externalSourceTable.descriptionShort,
        steamAppid: externalSourceTable.steamAppid,
        tags: externalSourceTable.tags,
        rawData: externalSourceTable.rawData,
        foundByUsername: profilesTable.username, // Add foundByUsername
      })
      .from(externalSourceTable)
      // Add left join
      .leftJoin(
        profilesTable,
        eq(externalSourceTable.foundBy, profilesTable.id)
      )
      .orderBy(desc(externalSourceTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    return NextResponse.json({ success: true, data: recentGames });
  } catch (error) {
    console.error("Error fetching recent games:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch recent games." },
      { status: 500 }
    );
  }
}
