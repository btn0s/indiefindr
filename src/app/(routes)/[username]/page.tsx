import React from "react";
import { createClient } from "@/utils/supabase/server"; // Use standard server client
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Metadata, ResolvingMetadata } from "next"; // Import Metadata types
// import { Database } from "@/lib/database.types"; // Removed - Use Drizzle types implicitly
import { GameGrid } from "@/components/game-grid"; // Import GameGrid
import { profilesTable, libraryTable, externalSourceTable } from "@/db/schema"; // Import schema tables
import { db } from "@/db"; // Import Drizzle instance
import { eq, and, sql, count } from "drizzle-orm";
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type
import {
  addToLibrary,
  removeFromLibrary,
  getLibraryGameIds,
} from "@/app/actions/library"; // Import library actions for GameCard
import { getGamesFoundByUser } from "@/app/actions/finds"; // Import the new action
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components

// Helper function for initials remains the same
const getUserInitials = (name?: string | null) => {
  if (!name) return "?";
  const names = name.split(" ");
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

// Define the type required by GameGrid
type GameForGrid = {
  // Renamed for clarity, as it's used by both grids now
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData?: SteamRawData | null; // Added for raw game data
  foundByUsername?: string | null; // Added for "Finds" section
};

// --- Generate Metadata Function ---
export async function generateMetadata(
  { params }: ProfilePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const p = await params;
  const decodedUsername = decodeURIComponent(p.username);
  let profileData = null;
  let findsCount = 0;

  // Fetch profile data specifically for metadata
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
      .where(eq(profilesTable.username, decodedUsername))
      .limit(1);

    if (result && result.length > 0) {
      profileData = result[0];

      // Next, count the games found by this user
      const findsResult = await db
        .select({
          count: count(),
        })
        .from(externalSourceTable)
        .where(eq(externalSourceTable.foundBy, profileData.id));

      if (findsResult.length > 0) {
        findsCount = Number(findsResult[0].count) || 0;
      }

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
    console.error("Metadata fetch error:", error);
    // Fall through to default metadata if fetch fails
  }

  // Default/fallback metadata if profile not found or error occurs
  const defaultTitle = `User Profile | IndieFindr`;
  const defaultDescription = "View user profiles on IndieFindr.";
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
// --- End Generate Metadata Function ---

export default async function ProfilePage({ params }: ProfilePageProps) {
  // Correctly instantiate the server client
  const supabase = await createClient();
  const p = await params;
  const decodedUsername = decodeURIComponent(p.username);

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
        descriptionShort: externalSourceTable.descriptionShort, // Correct field name
        steamAppid: externalSourceTable.steamAppid,
        rawData: sql<SteamRawData | null>`${externalSourceTable.rawData}`, // Select and cast rawData
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
        // Explicitly cast to GameForGrid[] if necessary, though action's FoundGame type should align
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
            src={profileData.avatarUrl ?? undefined} // Use avatarUrl from schema
            alt={profileData.username ?? "User avatar"}
          />
          <AvatarFallback className="text-4xl">
            {/* Use fullName from schema if available, fallback to username */}
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
                {/* TODO: Link to an actual edit profile page/modal */}
                <Link href="/settings/profile">Edit Profile</Link>
              </Button>
            )}
          </div>
          {profileData.fullName && ( // Use fullName from schema
            <p className="text-muted-foreground text-sm">
              {profileData.fullName}
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            {profileData.bio ?? "No bio yet."} {/* Use bio from schema */}
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

// Consider adding Revalidation if needed
// export const revalidate = 60; // Revalidate every 60 seconds

