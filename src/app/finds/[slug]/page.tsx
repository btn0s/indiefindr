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
  shortDescription: string | null;
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
    // Fetch id, steam url, and the raw json containing name/images/description
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
    let shortDescription: string | null = null;

    // Extract Steam App ID first
    if (find.sourceSteamUrl) {
      steamAppId = extractSteamAppId(find.sourceSteamUrl);
    }

    // Attempt to parse rawSteamJson for name, images, and description
    if (find.rawSteamJson) {
      let parsedData:
        | (Partial<RapidApiGameData> & { short_description?: string })
        | null = null;
      try {
        if (
          typeof find.rawSteamJson === "object" &&
          find.rawSteamJson !== null
        ) {
          parsedData = find.rawSteamJson as Partial<RapidApiGameData> & {
            short_description?: string;
          };
        } else if (typeof find.rawSteamJson === "string") {
          parsedData = JSON.parse(
            find.rawSteamJson
          ) as Partial<RapidApiGameData> & { short_description?: string };
        }

        if (parsedData) {
          gameName =
            typeof parsedData.name === "string" ? parsedData.name : null;
          shortDescription =
            typeof parsedData.short_description === "string"
              ? parsedData.short_description
              : null;
          // Get first screenshot if available
          firstScreenshotUrl =
            Array.isArray(parsedData.media?.screenshot) &&
            parsedData.media.screenshot.length > 0 &&
            typeof parsedData.media.screenshot[0] === "string"
              ? parsedData.media.screenshot[0]
              : null;
        }
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
      shortDescription,
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
    ? `${findData.gameName} has been found on IndieFindr`
    : defaultTitle;

  // Base description
  let baseDescription = findData?.gameName
    ? `Discover ${findData.gameName} on IndieFindr! Could this be your next favorite indie game?`
    : "Uncover a hidden gem on IndieFindr! Explore this exciting indie game, found on the best platform for discovering new favorites.";

  // Add flair using the short description if available
  let finalDescription = baseDescription;
  if (findData?.shortDescription) {
    // Clean up potential HTML entities (basic example)
    const cleanedDesc = findData.shortDescription
      .replace(/&quot;/g, '"')
      .replace(/<[^>]*>?/gm, ""); // Remove simple tags
    const truncatedDesc =
      cleanedDesc.length > 100
        ? cleanedDesc.substring(0, 97) + "..."
        : cleanedDesc;
    finalDescription = `${baseDescription} // ${truncatedDesc}`;
  }

  // Ensure total length isn't excessively long (optional refinement)
  if (finalDescription.length > 160) {
    finalDescription = finalDescription.substring(0, 157) + "...";
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
    description: finalDescription,
    openGraph: {
      title: title,
      description: finalDescription,
      images: images,
      type: "article",
    },
    twitter: {
      card:
        images.length > 0 && images[0].url !== "/og.png"
          ? "summary_large_image"
          : "summary",
      title: title,
      description: finalDescription,
      images: images.map((img) => img.url),
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
