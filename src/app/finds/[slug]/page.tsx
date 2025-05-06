import { Metadata, ResolvingMetadata } from "next";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import {
  type RapidApiGameData,
  type RapidApiReview,
} from "@/lib/rapidapi/types";
// We don't need RerunFormClient or actions here for metadata

// Type for the props received by both Page and generateMetadata
type PageProps = {
  params: { slug: string };
};

// Helper function to extract ID and fetch basic find data
async function getFindBasics(
  slug: string
): Promise<{ id: number; gameName: string | null } | null> {
  let findId: number | null = null;
  const parts = slug.split("-");
  const idStr = parts.length === 1 ? parts[0] : parts[parts.length - 1];
  const parsedId = parseInt(idStr, 10);

  if (!isNaN(parsedId)) {
    findId = parsedId;
  } else {
    console.log(`[Metadata] Could not determine valid ID from slug: ${slug}`);
    return null;
  }

  if (findId === null) {
    return null;
  }

  try {
    const result = await db
      .select({
        id: schema.finds.id,
        rawSteamJson: schema.finds.rawSteamJson,
      })
      .from(schema.finds)
      .where(eq(schema.finds.id, findId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const find = result[0];
    let gameName: string | null = null;

    if (find.rawSteamJson) {
      // Basic check for game name within the JSON structure
      if (
        typeof find.rawSteamJson === "object" &&
        find.rawSteamJson !== null &&
        typeof (find.rawSteamJson as any).name === "string"
      ) {
        gameName = (find.rawSteamJson as any).name;
      } else if (typeof find.rawSteamJson === "string") {
        try {
          const parsedData = JSON.parse(find.rawSteamJson);
          if (typeof parsedData?.name === "string") {
            gameName = parsedData.name;
          }
        } catch (e) {
          console.error(
            `[Metadata] Failed to parse rawSteamJson for find ${find.id}:`,
            e
          );
        }
      }
    }

    return { id: find.id, gameName };
  } catch (error) {
    console.error(`[Metadata] Error fetching find with ID ${findId}:`, error);
    return null;
  }
}

// --- generateMetadata Function ---
export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = params;
  const findBasics = await getFindBasics(slug);

  // Default title if find not found or name unavailable
  const defaultTitle = "Indie Game Find | IndieFindr";
  const title = findBasics?.gameName
    ? `${findBasics.gameName} | IndieFindr Find`
    : defaultTitle;
  const description = findBasics?.gameName
    ? `Analysis and audience appeal report for the indie game: ${findBasics.gameName}.`
    : "Detailed analysis of an indie game found on Steam.";

  // Optionally, you can fetch and add Open Graph images, etc.
  // const previousImages = (await parent).openGraph?.images || []

  return {
    title: title,
    description: description,
    // openGraph: {
    //   images: ['/some-specific-page-image.jpg', ...previousImages],
    // },
  };
}

// --- Page Component ---
export default async function Page({ params }: PageProps) {
  const { slug } = params;
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
    // Fetch all necessary data for the page display
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
    notFound(); // Should be caught by the query check, but belt and suspenders
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
        // Instead of notFound(), maybe proceed with null gameData or partial data?
        // For now, keeping original behavior. Consider if a page without gameData makes sense.
        notFound();
      }
    }
  }
  // If gameData is still null after attempts, treat as not found.
  if (!gameData) {
    console.error(
      `Game data is null or invalid after parsing for find ${fetchedFind.id}`
    );
    notFound();
  }

  // Parse Review Data (keep existing logic)
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
          reviewData = null; // Handle non-array JSON gracefully
        }
      } catch (e) {
        console.error(
          `Failed to parse rawReviewJson for find ${fetchedFind.id}:`,
          e
        );
        reviewData = null; // Set to null on parse error
      }
    } else {
      console.warn(
        `rawReviewJson is not an array or string for find ${fetchedFind.id}`
      );
      // Decide how to handle unexpected types, e.g., set to null
      reviewData = null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center sm:p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-5xl sm:px-4 relative">
        <IndieGameReport
          id={fetchedFind.id}
          gameData={gameData} // Already asserted as non-null above
          sourceSteamUrl={fetchedFind.sourceSteamUrl}
          audienceAppeal={fetchedFind.audienceAppeal}
          rawReviewJson={reviewData} // Pass potentially null reviewData
        />
        {/* Rerun form might need adjustment depending on final structure */}
        {/* <RerunFormClient findId={fetchedFind.id} action={rerunSimpleAnalysisAction} /> */}
      </div>
    </div>
  );
}
