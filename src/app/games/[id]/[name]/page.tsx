import React from "react";
import { db } from "@/db"; // Assuming db instance is exported from @/db
import { externalSourceTable, profilesTable } from "@/db/schema"; // Corrected import name
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation"; // For handling not found cases
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For potential actions later
import Link from "next/link";
import { MediaCarousel } from "@/components/media-carousel";
import type { SteamRawData, MediaItem, Movie, Screenshot } from "@/types/steam"; // Import shared types
import { GameImage } from "@/components/game-image"; // Import the new client component
import type { Metadata } from "next";

// Function to fetch game data server-side
async function getGame(id: string) {
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) {
    notFound(); // Trigger 404 if ID is not a valid number
  }

  try {
    const gameData = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        shortDescription: externalSourceTable.descriptionShort, // Corrected field name
        steamAppid: externalSourceTable.steamAppid,
        tags: externalSourceTable.tags,
        rawData: externalSourceTable.rawData,
        foundByUsername: profilesTable.username, // Select the username
        // Add other fields as needed from externalSource schema
      })
      .from(externalSourceTable)
      // Left join in case found_by is null
      .leftJoin(
        profilesTable,
        eq(externalSourceTable.foundBy, profilesTable.id)
      )
      .where(eq(externalSourceTable.id, gameId))
      .limit(1);

    if (!gameData || gameData.length === 0) {
      notFound(); // Trigger 404 if no game found with this ID
    }

    // Return the first (and only) result, potentially containing foundByUsername
    return gameData[0];
  } catch (error) {
    console.error("Error fetching game data:", error);
    // Consider throwing a specific error or returning a different state
    // For now, we'll let it bubble up or potentially trigger a 500 error page
    throw new Error("Failed to fetch game data.");
  }
}

interface GameDetailPageProps {
  params: Promise<{
    id: string;
    name: string; // Keep name for potential future use or consistency
  }>;
}

export async function generateMetadata({
  params,
}: GameDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  const rawData = game.rawData as SteamRawData;

  // Get the first screenshot URL if available
  const firstScreenshot = rawData?.screenshots?.[0]?.path_full;

  // Get the header image URL
  const headerImage = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;

  // Get the developer and publisher
  const developer = rawData?.developers?.[0] || "Unknown Developer";
  const publisher = rawData?.publishers?.[0] || "Unknown Publisher";

  // Build a rich description combining various data points
  const description = [
    game.shortDescription,
    `Developed by ${developer}.`,
    `Published by ${publisher}.`,
    game.tags?.length ? `Tags: ${game.tags.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${game.title} | IndieFindr`,
    description,
    openGraph: {
      title: `${game.title} | IndieFindr` || "Game Details",
      description: game.shortDescription || "No description available.",
      images: [
        {
          url: headerImage || firstScreenshot || "/placeholder-game.jpg",
          width: 1200,
          height: 630,
          alt: game.title || "Game Screenshot",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} | IndieFindr` || "Game Details",
      description: game.shortDescription || "No description available.",
      images: [firstScreenshot || headerImage || "/placeholder-game.jpg"],
    },
  };
}

// Make the component async to fetch data, destructure params directly
export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { id } = await params;

  const game = await getGame(id); // Fetch game data, now includes foundByUsername

  // Cast rawData to our type and extract data
  const rawData = game.rawData as SteamRawData;
  const foundBy = game.foundByUsername; // Get foundBy from the game object

  // --- Define potential image URLs in order of preference ---
  const potentialImageUrls = [
    game.steamAppid
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
      : null, // 1. header.jpg
    rawData?.capsule_image, // 2. capsule_image (medium)
    rawData?.capsule_imagev5, // 3. capsule_imagev5 (small)
    rawData?.screenshots?.[0]?.path_full, // 4. First full screenshot
    rawData?.background_raw, // 5. Raw background
    rawData?.background, // 6. Processed background
  ].filter((url): url is string => typeof url === "string" && url.length > 0); // Filter out null/undefined/empty strings and type guard

  // Extract other data using rawData
  const screenshots = rawData?.screenshots || [];
  const movies = rawData?.movies || [];
  const developer = rawData?.developers?.[0] || "Unknown Developer";
  const publisher = rawData?.publishers?.[0] || "Unknown Publisher";
  const releaseDate = rawData?.release_date?.date || "TBA";

  // Combine screenshots and movies into a single media array with videos first
  const mediaItems: MediaItem[] = [
    // Videos first
    ...movies.map(
      (movie): MediaItem => ({
        type: "video",
        data: movie,
      })
    ),
    // Then images
    ...screenshots.map(
      (screenshot): MediaItem => ({
        type: "image",
        data: screenshot,
      })
    ),
  ];

  return (
    <div className="container mx-auto py-6">
      {/* Media Carousel */}
      {mediaItems.length > 0 && (
        <div className="mb-6">
          <MediaCarousel mediaItems={mediaItems} gameTitle={game.title || ""} />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Left Column: Title, Description, Tags, Details */}
        <div className="md:w-2/3">
          {/* Game Title */}
          <h1 className="text-3xl font-bold mb-2">
            {game.title || "Untitled Game"}
          </h1>

          {/* Found By Badge */}
          {foundBy && (
            <Badge
              variant="secondary"
              className="mb-4 text-sm"
              title={`Found via: @${foundBy}`}
            >
              Found via: @{foundBy}
            </Badge>
          )}

          {/* Game description */}
          <p className="text-lg text-muted-foreground mb-6">
            {game.shortDescription || "No description available."}
          </p>

          {/* Game Details */}
          <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Developer</p>
              <p className="font-medium">{developer}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Publisher</p>
              <p className="font-medium">{publisher}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Release Date</p>
              <p className="font-medium">{releaseDate}</p>
            </div>
          </div>

          {/* Tags Display */}
          {game.tags && game.tags.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Header Image with Action Buttons */}
        <div className="md:w-1/3 shrink-0 space-y-4">
          {/* Use the new client component for rendering the image with fallback */}
          <GameImage
            altText={game.title ? `${game.title} Header` : "Game Header"}
            gameData={rawData}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Action Buttons */}
          {game.steamAppid && (
            <Button asChild className="w-full">
              <Link
                href={`https://store.steampowered.com/app/${game.steamAppid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Steam
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full">
            Add to Library
          </Button>
        </div>
      </div>
    </div>
  );
}

// Add aspect ratio utility class if not already present in globals.css or similar
// @layer utilities {
//   .aspect-header-image {
//     aspect-ratio: 460 / 215; /* Steam header image aspect ratio */
//   }
// }
