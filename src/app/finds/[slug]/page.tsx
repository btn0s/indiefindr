import { Metadata, ResolvingMetadata } from "next";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import {
  type RapidApiGameData,
  type RapidApiReview,
} from "@/lib/rapidapi/types";
// Import utils for image handling and ID extraction
import { extractSteamAppId, findGameImage } from "@/lib/utils";
// We don't need RerunFormClient or actions here for metadata

// Type for the props received by both Page and generateMetadata
type PageProps = {
  params: Promise<{ slug: string }>;
};

// Enhanced helper function to fetch data needed for metadata
async function getFindMetadataData(slug: string): Promise<{
  id: number;
  gameName: string | null;
  steamAppId: string | null;
  headerImageUrl: string | null;
  firstScreenshotUrl: string | null;
  gameDescription: string | null;
} | null> {
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
    // Fetch id, steam url, and the raw json containing relevant data
    const result = await db
      .select({
        id: schema.finds.id,
        sourceSteamUrl: schema.finds.sourceSteamUrl,
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
    let headerImageUrl: string | null = null;
    let firstScreenshotUrl: string | null = null;
    let steamAppId: string | null = null;
    let gameDescription: string | null = null;

    // Extract Steam App ID first
    if (find.sourceSteamUrl) {
      steamAppId = extractSteamAppId(find.sourceSteamUrl);
    }

    // Attempt to parse rawSteamJson for name, images, and description
    if (find.rawSteamJson) {
      try {
        let dataToParse = find.rawSteamJson;
        // If it's already an object, use it directly, otherwise parse the string
        const parsedJson =
          typeof dataToParse === "object" && dataToParse !== null
            ? dataToParse
            : JSON.parse(String(dataToParse)); // Ensure it's a string before parsing

        // Assert the parsed JSON to a simple object structure containing expected fields
        const potentialData = parsedJson as {
          name?: string;
          desc?: string;
          about_game?: string;
          media?: { screenshot?: string[] };
        };

        // Now safely access properties
        gameName =
          typeof potentialData.name === "string" ? potentialData.name : null;
        gameDescription =
          (typeof potentialData.desc === "string"
            ? potentialData.desc
            : null) ||
          (typeof potentialData.about_game === "string"
            ? potentialData.about_game
            : null);
        firstScreenshotUrl =
          Array.isArray(potentialData.media?.screenshot) &&
          potentialData.media.screenshot.length > 0 &&
          typeof potentialData.media.screenshot[0] === "string"
            ? potentialData.media.screenshot[0]
            : null;
      } catch (e) {
        console.error(
          `[Metadata] Failed to parse rawSteamJson for find ${find.id}:`,
          e
        );
        // Continue without parsed data
      }
    }

    // Fallback/override: Use steamAppId to construct the canonical header image URL
    if (steamAppId) {
      headerImageUrl = findGameImage(steamAppId);
    }

    return {
      id: find.id,
      gameName,
      steamAppId,
      headerImageUrl,
      firstScreenshotUrl,
      gameDescription,
    };
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
  const { slug } = await params;
  const findData = await getFindMetadataData(slug);

  const defaultTitle = "Indie Game Find | IndieFindr";
  const title = findData?.gameName
    ? `${findData.gameName} | Found on IndieFindr`
    : defaultTitle;

  // Base description
  let baseDescription = findData?.gameName
    ? `Discover ${findData.gameName} on IndieFindr! Could this be your next favorite indie game?`
    : "Uncover a hidden gem on IndieFindr! Explore this exciting indie game, found on the best platform for discovering new favorites.";

  // Append game description if available (using the correct fields)
  let finalDescription = baseDescription;
  if (findData?.gameDescription) {
    // Simple append - consider cleaning/truncating if needed for length/format
    finalDescription = `${baseDescription} - ${findData.gameDescription}`;
  }

  // Ensure total length isn't excessively long (optional refinement)
  if (finalDescription.length > 200) {
    // Adjust max length as needed
    finalDescription = finalDescription.substring(0, 197) + "...";
  }

  // Determine Open Graph image
  const images = [];
  if (findData?.headerImageUrl) {
    // Prioritize the direct/constructed Steam header image
    images.push({ url: findData.headerImageUrl });
  } else if (findData?.firstScreenshotUrl) {
    // Fallback to the first screenshot if header isn't available
    images.push({ url: findData.firstScreenshotUrl });
  }
  // Add a default OG image if no specific game image was found
  if (images.length === 0) {
    images.push({ url: "/og.png", width: 1200, height: 630 }); // Reference default layout image
  }

  return {
    title: title,
    description: finalDescription, // Use the final description with game desc appended
    openGraph: {
      title: title,
      description: finalDescription, // Use the final description with game desc appended
      images: images, // Use the determined image(s)
      type: "article", // More specific type for a game page
    },
    twitter: {
      card:
        images.length > 0 && images[0].url !== "/og.png"
          ? "summary_large_image"
          : "summary",
      title: title,
      description: finalDescription, // Use the final description with game desc appended
      images: images.map((img) => img.url), // Twitter uses image URL directly
    },
  };
}

// --- Page Component ---
export default async function Page({ params }: PageProps) {
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
    // Keep the original slug check
    console.error("Invalid or non-extractable ID format in slug:", slug);
    notFound();
  }

  // Original check remains the same
  if (findId === null) {
    // This path might be redundant now due to the check above, but keep for safety
    console.error("Invalid or non-extractable ID format in slug:", slug);
    notFound();
  }

  // Fetch data directly on the server for the page content
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
