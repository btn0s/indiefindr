import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import {
  type RapidApiGameData,
  type RapidApiReview,
} from "@/lib/rapidapi/types";
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
  let fetchedFind: {
    id: number;
    rawSteamJson: any;
    rawReviewJson: any;
    createdAt: Date;
    sourceSteamUrl: string | null;
    audienceAppeal: string | null;
  } | null = null;

  try {
    const result = await db
      .select({
        id: schema.finds.id,
        rawSteamJson: schema.finds.rawSteamJson,
        rawReviewJson: schema.finds.rawReviewJson,
        createdAt: schema.finds.createdAt,
        sourceSteamUrl: schema.finds.sourceSteamUrl,
        audienceAppeal: schema.finds.audienceAppeal,
      })
      .from(schema.finds)
      .where(eq(schema.finds.id, findId))
      .limit(1);

    if (result.length === 0) {
      notFound();
    }
    fetchedFind = result[0];
  } catch (error) {
    console.error(`Error fetching find with ID ${findId}:`, error);
    notFound();
  }

  // --- Parse Fetched Data ---
  if (!fetchedFind) {
    notFound();
  }

  let gameData: RapidApiGameData | null = null;
  if (fetchedFind.rawSteamJson) {
    if (
      typeof fetchedFind.rawSteamJson === "object" &&
      fetchedFind.rawSteamJson !== null
    ) {
      gameData = fetchedFind.rawSteamJson as RapidApiGameData;
    } else if (typeof fetchedFind.rawSteamJson === "string") {
      try {
        gameData = JSON.parse(fetchedFind.rawSteamJson) as RapidApiGameData;
      } catch (e) {
        console.error(
          `Failed to parse rawSteamJson for find ${fetchedFind.id}:`,
          e
        );
        notFound();
      }
    }
  }
  if (!gameData) {
    console.error(
      `Game data is null or invalid after parsing for find ${fetchedFind.id}`
    );
    notFound();
  }

  // Parse Review Data
  let reviewData: RapidApiReview[] | null = null;
  if (fetchedFind.rawReviewJson) {
    if (Array.isArray(fetchedFind.rawReviewJson)) {
      reviewData = fetchedFind.rawReviewJson as RapidApiReview[];
    } else if (typeof fetchedFind.rawReviewJson === "string") {
      try {
        reviewData = JSON.parse(fetchedFind.rawReviewJson) as RapidApiReview[];
        if (!Array.isArray(reviewData)) {
          console.warn(
            `Parsed rawReviewJson is not an array for find ${fetchedFind.id}`
          );
          reviewData = null;
        }
      } catch (e) {
        console.error(
          `Failed to parse rawReviewJson for find ${fetchedFind.id}:`,
          e
        );
        reviewData = null;
      }
    } else {
      console.warn(
        `rawReviewJson is not an array or string for find ${fetchedFind.id}`
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center sm:p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-5xl sm:px-4 relative">
        <IndieGameReport
          id={fetchedFind.id}
          gameData={gameData}
          sourceSteamUrl={fetchedFind.sourceSteamUrl}
          audienceAppeal={fetchedFind.audienceAppeal}
          rawReviewJson={reviewData}
        />
      </div>
    </div>
  );
}
