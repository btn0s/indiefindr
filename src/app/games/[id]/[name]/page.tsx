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

interface ReleaseDate {
  date: string;
  coming_soon: boolean;
}

interface SteamRawData {
  screenshots?: Screenshot[];
  developers?: string[];
  publishers?: string[];
  release_date?: ReleaseDate;
  [key: string]: any; // Allow other properties
}

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
  const developer = rawData?.developers?.[0] || "Unknown Developer";
  const publisher = rawData?.publishers?.[0] || "Unknown Publisher";
  const releaseDate = rawData?.release_date?.date || "TBA";

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Game Title */}
      <h1 className="text-3xl font-bold mb-4">
        {game.title || "Untitled Game"}
      </h1>

      {/* Screenshots Gallery (Simple version without carousel component) */}
      {screenshots.length > 0 && (
        <div className="mb-6">
          <div className="relative w-full overflow-hidden rounded-lg aspect-video">
            <Image
              src={screenshots[0].path_full}
              alt={`${game.title} Screenshot`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1000px"
              priority
            />

            {/* Thumbnails row below main image */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
              {screenshots.slice(0, 5).map((screenshot, index) => (
                <div
                  key={index}
                  className="w-16 h-9 relative rounded overflow-hidden border-2 border-white/80"
                >
                  <Image
                    src={screenshot.path_thumbnail}
                    alt={`Thumbnail ${index}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ))}
              {screenshots.length > 5 && (
                <div className="w-16 h-9 relative rounded overflow-hidden border-2 border-white/80 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    +{screenshots.length - 5}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Game info and smaller header image */}
        <div className="md:w-2/3">
          {/* Game description */}
          <p className="text-lg text-muted-foreground mb-6">
            {game.shortDescription || "No description available."}
          </p>

          {/* Header Image (Smaller version) */}
          {headerImageUrl && (
            <div className="mb-6 rounded-md overflow-hidden shadow-sm aspect-[460/215] relative w-full md:w-3/4">
              <Image
                src={headerImageUrl}
                alt={
                  game.title
                    ? `${game.title} Header Image`
                    : "Game Header Image"
                }
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
                className="object-cover"
              />
            </div>
          )}

          {/* Game Details */}
          <div className="mb-6 grid grid-cols-2 gap-2 text-sm">
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

        {/* Right Column: Actions */}
        <div className="md:w-1/3 space-y-4">
          {game.steamAppid && (
            <Button asChild className="w-full" size="lg">
              <Link
                href={`https://store.steampowered.com/app/${game.steamAppid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Steam
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full" size="lg">
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
