import React from "react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { externalSourceTable, profilesTable, libraryTable } from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { Metadata, ResolvingMetadata } from "next";
import type { SteamRawData } from "@/types/steam";
import { isNumeric } from "@/utils/string-utils";

// Import components for user profile
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GameGrid } from "@/components/game-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addToLibrary,
  removeFromLibrary,
  getLibraryGameIds,
} from "@/app/actions/library";
import { getGamesFoundByUser } from "@/app/actions/finds";

// Import components for game page
import { Badge } from "@/components/ui/badge";
import { MediaCarousel } from "@/components/media-carousel";
import { GameImage } from "@/components/game-image";
import { AddToLibraryButton } from "@/components/add-to-library-button";

// Helper function for user initials
const getUserInitials = (name?: string | null) => {
  if (!name) return "?";
  const names = name.split(" ");
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
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
        shortDescription: externalSourceTable.descriptionShort,
        steamAppid: externalSourceTable.steamAppid,
        tags: externalSourceTable.tags,
        rawData: externalSourceTable.rawData,
        foundByUsername: profilesTable.username,
      })
      .from(externalSourceTable)
      .leftJoin(
        profilesTable,
        eq(externalSourceTable.foundBy, profilesTable.id)
      )
      .where(eq(externalSourceTable.id, gameId))
      .limit(1);

    if (!gameData || gameData.length === 0) {
      notFound(); // Trigger 404 if no game found with this ID
    }

    return gameData[0];
  } catch (error) {
    console.error("Error fetching game data:", error);
    throw new Error("Failed to fetch game data.");
  }
}

// Define the type required by GameGrid
type GameForGrid = {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData?: SteamRawData | null;
  foundByUsername?: string | null;
};

interface DynamicPageProps {
  params: Promise<{
    gameIdOrUsername: string;
    title?: string;
  }>;
}

export async function generateMetadata(
  { params }: DynamicPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const p = await params;
  const gameIdOrUsername = decodeURIComponent(p.gameIdOrUsername);
  
  // Check if it's a game ID (numeric) or username
  if (isNumeric(gameIdOrUsername)) {
    // It's a game ID, generate game metadata
    try {
      const game = await getGame(gameIdOrUsername);
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
    } catch (error) {
      console.error("Game metadata fetch error:", error);
      // Fall through to default metadata
    }
  } else {
    // It's a username, generate profile metadata
    try {
      // First, get basic profile data
      const result = await db
        .select({
          id: profilesTable.id,
          username: profilesTable.username,
          bio: profilesTable.bio,
          fullName: profilesTable.fullName,
          avatarUrl: profilesTable.avatarUrl,
        })
        .from(profilesTable)
        .where(eq(profilesTable.username, gameIdOrUsername))
        .limit(1);

      if (result && result.length > 0) {
        const profileData = result[0];

        // Next, count the games found by this user
        const findsResult = await db
          .select({
            count: count(),
          })
          .from(externalSourceTable)
          .where(eq(externalSourceTable.foundBy, profileData.id));

        const findsCount = findsResult.length > 0 ? Number(findsResult[0].count) || 0 : 0;

        const previousTitle = (await parent).title?.absolute || "IndieFindr";
        const title = `${profileData.username}'s Profile | ${previousTitle}`;
        const description = profileData.bio
          ? `${profileData.username}'s bio: ${profileData.bio.substring(0, 150)}${profileData.bio.length > 150 ? "..." : ""}`
          : `${profileData.username}'s profile page on IndieFindr, featuring their game library and finds.`;

        return {
          title: title,
          description: description,
          openGraph: {
            title: title,
            description: description,
          },
          twitter: {
            title: title,
            description: description,
            card: "summary_large_image",
          },
        };
      }
    } catch (error) {
      console.error("Profile metadata fetch error:", error);
      // Fall through to default metadata
    }
  }

  // Default/fallback metadata
  const defaultTitle = `IndieFindr`;
  const defaultDescription = "Discover indie games on IndieFindr.";
  return {
    title: defaultTitle,
    description: defaultDescription,
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
    },
    twitter: {
      title: defaultTitle,
      description: defaultDescription,
      card: "summary",
    },
  };
}

export default async function DynamicPage({ params }: DynamicPageProps) {
  const p = await params;
  const gameIdOrUsername = decodeURIComponent(p.gameIdOrUsername);
  
  // If there's a title parameter and the gameIdOrUsername is numeric, redirect to the new URL format
  if (p.title && isNumeric(gameIdOrUsername)) {
    return redirect(`/games/${gameIdOrUsername}/${p.title}`);
  }

  // Check if it's a game ID (numeric) or username
  if (isNumeric(gameIdOrUsername)) {
    // It's a game ID, render game page
    return <GameDetailPage gameId={gameIdOrUsername} />;
  } else {
    // It's a username, render profile page
    return <ProfilePage username={gameIdOrUsername} />;
  }
}

// Game Detail Page Component
async function GameDetailPage({ gameId }: { gameId: string }) {
  const game = await getGame(gameId);

  // Cast rawData to our type and extract data
  const rawData = game.rawData as SteamRawData;
  const foundBy = game.foundByUsername;

  // Define potential image URLs in order of preference
  const potentialImageUrls = [
    game.steamAppid
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
      : null,
    rawData?.capsule_image,
    rawData?.capsule_imagev5,
    rawData?.screenshots?.[0]?.path_full,
    rawData?.background_raw,
    rawData?.background,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  // Extract other data using rawData
  const screenshots = rawData?.screenshots || [];
  const movies = rawData?.movies || [];
  const developer = rawData?.developers?.[0] || "Unknown Developer";
  const publisher = rawData?.publishers?.[0] || "Unknown Publisher";
  const releaseDate = rawData?.release_date?.date || "TBA";

  // Combine screenshots and movies into a single media array with videos first
  const mediaItems = [
    // Videos first
    ...movies.map((movie) => ({
      type: "video",
      data: movie,
    })),
    // Then images
    ...screenshots.map((screenshot) => ({
      type: "image",
      data: screenshot,
    })),
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
            <Link href={`/${foundBy}`}>
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
          <AddToLibraryButton gameId={game.id} />
        </div>
      </div>
    </div>
  );
}

// Profile Page Component
async function ProfilePage({ username }: { username: string }) {
  // Correctly instantiate the server client
  const supabase = await createClient();
  const decodedUsername = decodeURIComponent(username);

  // 1. Fetch the profile user's data using Drizzle
  let profileData;
  try {
    const result = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.username, decodedUsername))
      .limit(1);

    if (!result || result.length === 0) {
      notFound();
    }
    profileData = result[0];
  } catch (error) {
    console.error("Profile fetch error:", error);
    notFound(); // Or show a specific error page
  }

  // 2. Fetch the *authenticated* logged-in user
  const {
    data: { user: loggedInUser },
  } = await supabase.auth.getUser();
  const loggedInUserId = loggedInUser?.id;

  // Ensure profileData is defined before accessing its id
  const isOwner = !!profileData && loggedInUserId === profileData.id;

  // 3. Fetch the profile user's library game details using Drizzle
  let libraryGames: GameForGrid[] = [];
  try {
    libraryGames = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        descriptionShort: externalSourceTable.descriptionShort,
        steamAppid: externalSourceTable.steamAppid,
        rawData: sql<SteamRawData | null>`${externalSourceTable.rawData}`,
      })
      .from(libraryTable)
      .innerJoin(
        externalSourceTable,
        eq(libraryTable.gameRefId, externalSourceTable.id)
      )
      .where(eq(libraryTable.userId, profileData.id));
  } catch (error) {
    console.error("Library fetch error:", error);
    // Handle error appropriately, maybe show an empty library section or log
  }

  // 4. Get the IDs of games in the *logged-in* user's library for the GameCard buttons
  let loggedInUserLibraryIds = new Set<number>();
  if (loggedInUserId) {
    try {
      const libraryResult = await getLibraryGameIds(); // Uses server action for the logged-in user
      if (libraryResult.success && libraryResult.data) {
        loggedInUserLibraryIds = new Set(libraryResult.data);
      }
    } catch (error) {
      console.error("Failed to get logged-in user library IDs:", error);
    }
  }

  // 5. Fetch games found by the profile user
  let foundGames: GameForGrid[] = [];
  if (profileData?.id) {
    try {
      const foundGamesResult = await getGamesFoundByUser(profileData.id);
      if (foundGamesResult.success && foundGamesResult.data) {
        foundGames = foundGamesResult.data as GameForGrid[];
      } else {
        console.warn(
          "Failed to fetch games found by user:",
          foundGamesResult.error
        );
      }
    } catch (error) {
      console.error("Error fetching games found by user:", error);
    }
  }

  return (
    <div className="container max-w-5xl mx-auto py-8">
      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
        <Avatar className="h-24 w-24 md:h-32 md:w-32 border">
          <AvatarImage
            src={profileData.avatarUrl ?? undefined}
            alt={profileData.username ?? "User avatar"}
          />
          <AvatarFallback className="text-4xl">
            {getUserInitials(profileData.fullName ?? profileData.username)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">
              {profileData.username}
            </h1>
            {isOwner && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/profile">Edit Profile</Link>
              </Button>
            )}
          </div>
          {profileData.fullName && (
            <p className="text-muted-foreground text-sm">
              {profileData.fullName}
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            {profileData.bio ?? "No bio yet."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="finds" className="mt-6">
        <TabsList className="mb-4">
          <TabsTrigger value="finds" disabled={foundGames.length === 0}>
            Finds ({foundGames.length})
          </TabsTrigger>
          <TabsTrigger value="library">
            Library ({libraryGames?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          {libraryGames && libraryGames.length > 0 ? (
            <GameGrid
              games={libraryGames}
              loggedInUserLibraryIds={loggedInUserLibraryIds}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
            />
          ) : (
            <p className="text-muted-foreground">This library is empty.</p>
          )}
        </TabsContent>

        <TabsContent value="finds">
          {foundGames.length > 0 ? (
            <GameGrid
              games={foundGames}
              loggedInUserLibraryIds={loggedInUserLibraryIds}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
            />
          ) : (
            <p className="text-muted-foreground">No games found yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

