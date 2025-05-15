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

import { DefaultGameService } from "@/services/game-service"; // <-- Import GameService

const gameRepository = new DrizzleGameRepository(); // Instantiate repository
const gameService = new DefaultGameService(); // <-- Instantiate GameService

// Function to fetch game data server-side using the repository
async function getRawGameData(id: string): Promise<GameWithSubmitter> {
  // Renamed for clarity
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
  const rawGame = await getRawGameData(usernameOrGameId); // Use new function name
  const gameVM = gameService.toGameProfileViewModel(rawGame); // Transform for metadata

  // Use gameVM fields for metadata
  const ogImage =
    gameVM.headerImageUrl ??
    (gameVM.screenshotUrls.length > 0
      ? gameVM.screenshotUrls[0]
      : "/placeholder-game.jpg");

  const description = [
    gameVM.shortDescription,
    gameVM.developer ? `Developed by ${gameVM.developer}.` : null,
    gameVM.publisher ? `Published by ${gameVM.publisher}.` : null,
    gameVM.tags?.length ? `Tags: ${gameVM.tags.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${gameVM.title} | IndieFindr`,
    description,
    openGraph: {
      title: `${gameVM.title} | IndieFindr`,
      description: gameVM.shortDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: gameVM.title || "Game Screenshot",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${gameVM.title} | IndieFindr`,
      description: gameVM.shortDescription,
      images: [ogImage],
    },
  };
}

// Make the component async to fetch data, destructure params directly
export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { usernameOrGameId } = await params;

  const rawGame = await getRawGameData(usernameOrGameId); // Fetch raw game data
  const game = gameService.toGameProfileViewModel(rawGame); // Transform using GameService

  // Most of the data extraction logic below can now be removed or simplified
  // as it's provided by the game (GameProfileViewModel) object.

  // Cast rawData to our type and extract data - NO LONGER NEEDED directly for most things
  // const rawData = rawGame.rawData as SteamRawData;
  const foundBy = game.foundByUsername; // Get foundBy from the game (GameProfileViewModel)

  // --- Define potential image URLs in order of preference --- NO LONGER NEEDED
  /*
  const potentialImageUrls = [
    rawGame.steamAppid
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${rawGame.steamAppid}/header.jpg`
      : null, 
    (rawGame.rawData as SteamRawData)?.capsule_image, 
    (rawGame.rawData as SteamRawData)?.capsule_imagev5, 
    (rawGame.rawData as SteamRawData)?.screenshots?.[0]?.path_full, 
    (rawGame.rawData as SteamRawData)?.background_raw, 
    (rawGame.rawData as SteamRawData)?.background, 
  ].filter((url): url is string => typeof url === "string" && url.length > 0);
  */

  // Extract other data using rawData - NO LONGER NEEDED
  // const screenshots = (rawGame.rawData as SteamRawData)?.screenshots || [];
  // const movies = (rawGame.rawData as SteamRawData)?.movies || [];
  // const developer = (rawGame.rawData as SteamRawData)?.developers?.[0] || "Unknown Developer";
  // const publisher = (rawGame.rawData as SteamRawData)?.publishers?.[0] || "Unknown Publisher";
  // const releaseDate = (rawGame.rawData as SteamRawData)?.release_date?.date || "TBA";

  // Combine screenshots and movies into a single media array with videos first
  const mediaItems: MediaItem[] = [
    // Videos first, using game.videoUrls from GameProfileViewModel
    ...game.videoUrls.map(
      (video): MediaItem => ({
        type: "video",
        // The `data` for MediaItem of type video expects a `Movie` object from SteamRawData.
        // We need to adapt game.videoUrls (which is {type, url, title, thumbnail}) to this.
        // This might require a small adjustment in MediaItem type or how MediaCarousel consumes it,
        // or we construct a mock Movie object here.
        // For now, constructing a mock Movie structure.
        data: {
          id: 0, // Placeholder
          name: video.title || "Video",
          thumbnail: video.thumbnail || "",
          highlight: false, // Placeholder
          mp4: { "480": video.url, max: video.url }, // Assuming url is mp4
          webm: { "480": "", max: "" }, // Placeholder
        } as Movie,
      })
    ),
    // Then images, using game.screenshotUrls from GameProfileViewModel
    ...game.screenshotUrls.map(
      (screenshotUrl, index): MediaItem => ({
        type: "image",
        // The `data` for MediaItem of type image expects a `Screenshot` object.
        // Constructing a mock Screenshot structure.
        data: {
          id: index, // Placeholder
          path_thumbnail: screenshotUrl,
          path_full: screenshotUrl,
        } as Screenshot,
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
            {game.title || "Untitled Game"}{" "}
            {/* Use game.title from ViewModel */}
          </h1>

          {/* Found By Badge */}
          {foundBy && ( // foundBy is already game.foundByUsername
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
            {game.detailedDescription ||
              game.shortDescription ||
              "No description available."}{" "}
            {/* Use game from ViewModel */}
          </p>

          {/* Game Details */}
          <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Developer</p>
              <p className="font-medium">
                {game.developer || "Unknown Developer"}
              </p>{" "}
              {/* Use game.developer */}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Publisher</p>
              <p className="font-medium">
                {game.publisher || "Unknown Publisher"}
              </p>{" "}
              {/* Use game.publisher */}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Release Date</p>
              <p className="font-medium">
                {game.releaseDate?.date || "TBA"}
              </p>{" "}
              {/* Use game.releaseDate.date */}
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
            // GameImage expects SteamRawData. We pass a minimal version based on ViewModel.
            gameData={{
              header_image: game.headerImageUrl,
              capsule_image: game.coverImageUrl,
              screenshots: game.screenshotUrls.map((url, idx) => ({
                id: idx,
                path_full: url,
                path_thumbnail: url,
              })),
              movies: game.videoUrls.map((v) => ({
                id: 0,
                name: v.title || "",
                thumbnail: v.thumbnail || "",
                highlight: false,
                mp4: { "480": v.url, max: v.url },
                webm: { "480": "", max: "" },
              })),
            }}
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
