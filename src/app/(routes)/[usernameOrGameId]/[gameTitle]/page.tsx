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
import { AddToLibraryButton } from "@/components/add-to-library-button"; // Import the new component
import { gameService } from "@/services"; // Import the game service
import type { RawGameData } from "@/types/game-models"; // Import the RawGameData type

// Function to fetch game data server-side
async function getGame(id: string) {
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) {
    notFound();
  }

  try {
    const gameData = await db
      .select({
        id: externalSourceTable.id,
        platform: externalSourceTable.platform,
        externalId: externalSourceTable.externalId,
        title: externalSourceTable.title,
        developer: externalSourceTable.developer,
        descriptionShort: externalSourceTable.descriptionShort,
        descriptionDetailed: externalSourceTable.descriptionDetailed,
        genres: externalSourceTable.genres,
        tags: externalSourceTable.tags,
        rawData: externalSourceTable.rawData,
        steamAppid: externalSourceTable.steamAppid,
        createdAt: externalSourceTable.createdAt,
        foundBy: externalSourceTable.foundBy,
        // Join with profiles to get the username of who found the game
        foundByUsername: profilesTable.username,
        foundByAvatarUrl: profilesTable.avatarUrl,
      })
      .from(externalSourceTable)
      .leftJoin(
        profilesTable,
        eq(externalSourceTable.foundBy, profilesTable.id)
      )
      .where(eq(externalSourceTable.id, gameId));

    if (!gameData || gameData.length === 0) {
      notFound(); // Trigger 404 if no game found with this ID
    }

    return gameData[0] as RawGameData;
  } catch (error) {
    console.error("Error fetching game data:", error);
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
  const gameData = await getGame(usernameOrGameId);
  
  // Transform raw game data to profile view model
  const game = gameService.toGameProfileViewModel(gameData);
  
  // Get the first screenshot or header image for OpenGraph
  const headerImage = game.imageUrl;
  const firstScreenshot = game.media.screenshots[0]?.fullUrl;
  
  // Construct a description combining short description and tags
  const description = [
    game.description,
    game.tags?.length ? `Tags: ${game.tags.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${game.title} | IndieFindr`,
    description: description || "No description available.",
    openGraph: {
      title: `${game.title} | IndieFindr` || "Game Details",
      description: game.description || "No description available.",
      images: [
        {
          url: firstScreenshot || headerImage || "/placeholder-game.jpg",
          width: 1200,
          height: 630,
          alt: game.title || "Game Screenshot",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} | IndieFindr` || "Game Details",
      description: game.description || "No description available.",
      images: [firstScreenshot || headerImage || "/placeholder-game.jpg"],
    },
  };
}

// Make the component async to fetch data, destructure params directly
export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { usernameOrGameId } = await params;

  const gameData = await getGame(usernameOrGameId);
  
  // Transform raw game data to profile view model
  const game = gameService.toGameProfileViewModel(gameData);
  
  // Prepare media items for the carousel
  const mediaItems: MediaItem[] = [
    ...game.media.screenshots.map((screenshot): MediaItem => ({
      type: "image",
      data: {
        id: screenshot.id,
        path_thumbnail: screenshot.thumbnailUrl,
        path_full: screenshot.fullUrl,
      },
    })),
    ...game.media.videos.map((video): MediaItem => ({
      type: "video",
      data: {
        id: video.id,
        name: video.name,
        thumbnail: video.thumbnailUrl,
        webm: {
          480: "",
          max: video.webmUrl,
        },
        mp4: {
          480: "",
          max: video.mp4Url,
        },
        highlight: true,
      },
    })),
  ];

  return (
    <div className="container py-8 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column - Game info */}
        <div className="md:col-span-2 space-y-6">
          {/* Media carousel */}
          {mediaItems.length > 0 && (
            <MediaCarousel mediaItems={mediaItems} gameTitle={game.title || ""} />
          )}

          <div className="space-y-4">
            {/* Game Title */}
            <h1 className="text-3xl font-bold">
              {game.title || "Untitled Game"}
            </h1>

            {/* Developer/Publisher info */}
            {(game.developers || game.publishers) && (
              <div className="text-sm text-muted-foreground">
                {game.developers && (
                  <p>
                    <span className="font-medium">Developer:</span>{" "}
                    {game.developers.join(", ")}
                  </p>
                )}
                {game.publishers && (
                  <p>
                    <span className="font-medium">Publisher:</span>{" "}
                    {game.publishers.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Game description */}
            <p className="text-base leading-relaxed">
              {game.description || "No description available."}
            </p>

            {/* Game Details */}
            <div className="space-y-4">
              {/* Release date */}
              {game.releaseDate && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Release Date
                  </h3>
                  <p>
                    {game.isComingSoon
                      ? `Coming Soon (${game.releaseDate})`
                      : game.releaseDate}
                  </p>
                </div>
              )}

              {/* Tags */}
              {game.tags && game.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {game.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Cover art and actions */}
        <div className="space-y-4">
          <div className="rounded-md overflow-hidden border">
            <GameImage
              altText={game.title ? `${game.title} Header` : "Game Header"}
              gameData={gameData.rawData as SteamRawData}
              sizes="(max-width: 768px) 100vw, 300px"
            />
          </div>

          <div className="space-y-2">
            {/* Steam link */}
            {game.platformUrls.steam && (
              <Button
                asChild
                className="w-full"
                variant="default"
              >
                <Link
                  href={game.platformUrls.steam}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SteamIcon className="mr-2 h-4 w-4" />
                  View on Steam
                </Link>
              </Button>
            )}

            {/* Add to library button */}
            <AddToLibraryButton gameId={game.id} />
          </div>

          {/* Found by */}
          {game.foundBy.username && game.foundBy.username !== "IndieFindr" && (
            <div className="mt-6 p-4 border rounded-md">
              <p className="text-sm text-muted-foreground">
                Found by{" "}
                <Link
                  href={`/user/${game.foundBy.username}`}
                  className="font-medium text-primary hover:underline"
                >
                  {game.foundBy.username}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
