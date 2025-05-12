import React from "react";
import { db } from "@/db"; // Assuming db instance is exported from @/db
import { externalSourceTable } from "@/db/schema"; // Corrected import name
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation"; // For handling not found cases
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For potential actions later
import Link from "next/link";

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

  const imageUrl = game.steamAppid
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
    : null; // Or a placeholder image URL

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Image */}
        <div className="md:w-1/3 lg:w-1/4 shrink-0">
          <div className="aspect-header-image rounded bg-foreground/50 overflow-hidden border relative w-full">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={
                  game.title
                    ? `${game.title} Header Image`
                    : "Game Header Image"
                }
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
                priority // Prioritize loading the main image
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  No Image Available
                </span>
              </div>
            )}
          </div>
          {/* Steam Store Link Button */}
          {game.steamAppid && (
            <Button asChild className="mt-4 w-full">
              <Link
                href={`https://store.steampowered.com/app/${game.steamAppid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Steam
              </Link>
            </Button>
          )}
          {/* Add to Library Button (Placeholder/Future) */}
          {/* <Button variant="outline" className="mt-2 w-full">Add to Library</Button> */}
        </div>

        {/* Right Column: Details */}
        <div className="md:w-2/3 lg:w-3/4">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">
            {game.title || "Untitled Game"}
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            {game.shortDescription || "No description available."}
          </p>

          {/* Tags Display */}
          {game.tags && game.tags.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder for more details */}
          {/* <h2 className="text-xl font-semibold mb-2">Details</h2>
             <p>Developer: ...</p>
             <p>Publisher: ...</p>
             <p>Release Date: ...</p>
          */}
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
