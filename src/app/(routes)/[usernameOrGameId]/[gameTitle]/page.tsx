import React from "react";
import {
  DrizzleGameRepository,
  GameWithSubmitter,
} from "@/lib/repositories/game-repository"; // Import repository
import { notFound } from "next/navigation"; // For handling not found cases
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For potential actions later
import Link from "next/link";
import { MediaCarousel } from "@/components/media-carousel";
import type { SteamRawData, MediaItem, Movie, Screenshot } from "@/types/steam"; // Import shared types
import { GameImage } from "@/components/game-image"; // Import the new client component
import type { Metadata } from "next";
import { AddToLibraryButton } from "@/components/add-to-library-button"; // Import the new component

const gameRepository = new DrizzleGameRepository(); // Instantiate repository

// Function to fetch game data server-side using the repository
async function getGame(id: string): Promise<GameWithSubmitter> {
  // Return type is now GameWithSubmitter
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) {
    notFound();
  }

  try {
    const gameData = await gameRepository.getById(gameId); // Use repository method

    if (!gameData) {
      notFound();
    }
    // The repository method already returns GameWithSubmitter | null
    // The check above ensures it's not null here.
    return gameData;
  } catch (error) {
    console.error("Error fetching game data via repository:", error);
    // Consider specific error handling or re-throwing
    // For now, mimic original behavior of throwing a generic error or letting Next.js handle
    if (error instanceof Error && error.message.includes("not found")) {
      // Or a custom NotFoundError from repo
      notFound();
    }
    throw new Error("Failed to fetch game data.");
  }
}

interface GameDetailPageProps {
  params: Promise<{
    usernameOrGameId: string;
    gameTitle: string; // Keep name for potential future use or consistency
  }>;
}

export async function generateMetadata({
  params,
}: GameDetailPageProps): Promise<Metadata> {
  const { usernameOrGameId, gameTitle } = await params;
  const game = await getGame(usernameOrGameId);
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
    game.descriptionShort,
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
      description: game.descriptionShort || "No description available.",
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
      description: game.descriptionShort || "No description available.",
      images: [firstScreenshot || headerImage || "/placeholder-game.jpg"],
    },
  };
}

// Make the component async to fetch data, destructure params directly
export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { usernameOrGameId } = await params;

  const game = await getGame(usernameOrGameId); // Fetch game data, now includes foundByUsername

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
            <Link href={`/user/${foundBy}`}>
              <Badge
                variant="secondary"
                className="mb-4 text-xs"
                title={`Found by @${foundBy}`}
              >
                Found by @{foundBy}
              </Badge>
            </Link>
          )}

          {/* Game description */}
          <p className="text-lg text-muted-foreground mb-6">
            {game.descriptionShort || "No description available."}
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
          <AddToLibraryButton gameId={game.id} />
        </div>
      </div>
    </div>
  );
}
