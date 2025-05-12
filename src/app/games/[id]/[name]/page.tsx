import React from "react";
import { db } from "@/db"; // Assuming db instance is exported from @/db
import { externalSourceTable } from "@/db/schema"; // Corrected import name
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation"; // For handling not found cases
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For potential actions later
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Define types for the rawData structure
interface Screenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

interface Movie {
  id: number;
  name: string;
  thumbnail: string;
  webm: {
    480: string;
    max: string;
  };
  mp4: {
    480: string;
    max: string;
  };
  highlight: boolean;
}

interface ReleaseDate {
  date: string;
  coming_soon: boolean;
}

interface SteamRawData {
  screenshots?: Screenshot[];
  movies?: Movie[];
  developers?: string[];
  publishers?: string[];
  release_date?: ReleaseDate;
  [key: string]: any; // Allow other properties
}

// Define a media item type that can be either screenshot or movie
type MediaItem = {
  type: "image" | "video";
  data: Screenshot | Movie;
};

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
        // Add other fields as needed from externalSource schema
      })
      .from(externalSourceTable)
      .where(eq(externalSourceTable.id, gameId))
      .limit(1);

    if (!gameData || gameData.length === 0) {
      notFound(); // Trigger 404 if no game found with this ID
    }

    return gameData[0]; // Return the first (and only) result
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

// Make the component async to fetch data, destructure params directly
export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { id } = await params;
  const game = await getGame(id); // Fetch game data

  console.log(game);

  // Header image from Steam
  const headerImageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null;

  // Cast rawData to our type and extract data
  const rawData = game.rawData as SteamRawData;
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
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Media Carousel */}
      {mediaItems.length > 0 && (
        <div className="mb-6 relative">
          <Carousel className="w-full">
            <CarouselContent>
              {mediaItems.map((item, index) => (
                <CarouselItem key={index}>
                  <div className="aspect-video relative rounded-lg overflow-hidden bg-black">
                    {item.type === "image" ? (
                      <Image
                        src={(item.data as Screenshot).path_full}
                        alt={`${game.title} Media ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1000px"
                      />
                    ) : (
                      <video
                        src={(item.data as Movie).mp4.max}
                        poster={(item.data as Movie).thumbnail}
                        autoPlay
                        muted
                        controls
                        loop
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>

          {/* Thumbnails row */}
          <div className="mt-4 flex justify-center gap-2 px-4 overflow-x-auto py-2">
            {mediaItems.slice(0, 10).map((item, index) => (
              <div
                key={index}
                className="w-20 h-12 relative rounded overflow-hidden border-2 border-white/80 flex-shrink-0 cursor-pointer"
              >
                {item.type === "image" ? (
                  <Image
                    src={(item.data as Screenshot).path_thumbnail}
                    alt={`Thumbnail ${index}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={(item.data as Movie).thumbnail}
                      alt={`Video Thumbnail ${index}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-0.5"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {mediaItems.length > 10 && (
              <div className="w-20 h-12 relative rounded overflow-hidden border-2 border-white/80 bg-black/50 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">
                  +{mediaItems.length - 10}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Left Column: Title, Description, Tags, Details */}
        <div className="md:w-2/3">
          {/* Game Title */}
          <h1 className="text-3xl font-bold mb-4">
            {game.title || "Untitled Game"}
          </h1>

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
          {headerImageUrl && (
            <div className="rounded-md overflow-hidden shadow-sm aspect-[460/215] relative w-full">
              <Image
                src={headerImageUrl}
                alt={
                  game.title
                    ? `${game.title} Header Image`
                    : "Game Header Image"
                }
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
            </div>
          )}

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
