import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import { type RapidApiGameData } from "@/lib/rapidapi/types";
import { RerunFormClient } from "@/components/RerunFormClient";

// Import only the simple rerun server action
import { rerunSimpleAnalysisAction } from "./actions";

// Type for the data fetched by getFindById
interface FindPageData {
  id: number;
  sourceSteamUrl: string | null;
  gameData: RapidApiGameData | null;
  audienceAppeal: string | null;
  createdAt: Date;
}

// This is now an async Server Component
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Directly use the slug from params
  const { slug } = await params;
  let findId: number | null = null;

  // Split by dash and check length
  const parts = slug.split("-");
  const idStr = parts.length === 1 ? parts[0] : parts[parts.length - 1];
  const parsedId = parseInt(idStr, 10);

  if (!isNaN(parsedId)) {
    findId = parsedId;
    console.log(`[Find Page] Resolved ID from slug: ${findId}`);
  } else {
    console.log(`[Find Page] Could not determine valid ID from slug: ${slug}`);
  }

  // Original check remains the same
  if (findId === null) {
    console.error("Invalid or non-extractable ID format in slug:", slug);
    notFound();
  }

  // Fetch data directly on the server
  console.log(`[Find Page] Fetching data for resolved find ID: ${findId}`);
  let initialFindData: FindPageData | null = null;
  try {
    const result = await db
      .select({
        id: schema.finds.id,
        rawSteamJson: schema.finds.rawSteamJson,
        createdAt: schema.finds.createdAt,
        sourceSteamUrl: schema.finds.sourceSteamUrl,
        audienceAppeal: schema.finds.audienceAppeal,
      })
      .from(schema.finds)
      .where(eq(schema.finds.id, findId))
      .limit(1);

    if (result.length === 0) {
      notFound(); // Not found
    }

    const find = result[0];
    let gameData: RapidApiGameData | null = null;

    // Parse the rawSteamJson
    if (find.rawSteamJson) {
      if (typeof find.rawSteamJson === "object" && find.rawSteamJson !== null) {
        gameData = find.rawSteamJson as RapidApiGameData;
      } else if (typeof find.rawSteamJson === "string") {
        try {
          gameData = JSON.parse(find.rawSteamJson) as RapidApiGameData;
        } catch (e) {
          console.error(`Failed to parse rawSteamJson for find ${find.id}:`, e);
          // If parsing fails, treat as critical
          notFound();
        }
      }
    }

    // If gameData couldn't be derived, treat as not found
    if (!gameData) {
      console.error(
        `Game data is null or invalid after parsing for find ${find.id}`
      );
      notFound();
    }

    initialFindData = {
      id: find.id,
      gameData: gameData,
      createdAt: find.createdAt,
      sourceSteamUrl: find.sourceSteamUrl ?? null,
      audienceAppeal: find.audienceAppeal ?? null,
    };
  } catch (error) {
    console.error(`Error fetching find with ID ${findId}:`, error);
    // Consider showing a generic error page instead of notFound for DB errors
    notFound(); // Or throw error to trigger error.tsx
  }

  // Rerun is only possible if we have a source Steam URL
  const sourceUrlForRerun: string | null =
    initialFindData?.sourceSteamUrl ?? null;

  return initialFindData?.gameData ? (
    <div className="min-h-screen flex flex-col items-center sm:p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-5xl sm:px-4">
        {/* Pass the Steam URL and simple action */}
        {/* The form component will handle disabling if URL is null */}
        {process.env.NODE_ENV === "development" && (
          <RerunFormClient
            findId={initialFindData.id}
            sourceSteamUrl={sourceUrlForRerun}
          />
        )}
        {/* Render the report directly, passing gameData and sourceSteamUrl */}
        <IndieGameReport
          gameData={initialFindData.gameData}
          sourceSteamUrl={initialFindData.sourceSteamUrl}
          audienceAppeal={initialFindData.audienceAppeal}
        />
      </div>
    </div>
  ) : (
    // This condition might be less likely now due to earlier notFound calls
    <div>No data found or data is invalid</div>
  );
}
