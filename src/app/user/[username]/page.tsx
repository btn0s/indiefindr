import React from "react";
import { createClient } from "@/utils/supabase/server"; // Use standard server client
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
// import { Database } from "@/lib/database.types"; // Removed - Use Drizzle types implicitly
import { GameCard } from "@/components/game-card"; // Import the actual GameCard
import { profilesTable, libraryTable, externalSourceTable } from "@/db/schema"; // Import schema tables
import { db } from "@/db"; // Import Drizzle instance
import { eq, and } from "drizzle-orm";
import {
  addToLibrary,
  removeFromLibrary,
  getLibraryGameIds,
} from "@/app/actions/library"; // Import library actions for GameCard

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

// Define the shape of the game data expected by GameCard based on its props
// This should match the selection in the library query
type LibraryGameForCard = {
  id: number;
  title: string | null;
  shortDescription: string | null; // Assuming GameCard uses this (or descriptionShort from schema)
  steamAppid: string | null;
  tags: string[] | null;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  // Correctly instantiate the server client
  const supabase = await createClient(); // Await the async function, no args needed
  const { username } = await params;
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
  // Select fields required by GameCard
  let libraryGames: LibraryGameForCard[] = [];
  try {
    libraryGames = await db
      .select({
        id: externalSourceTable.id,
        title: externalSourceTable.title,
        shortDescription: externalSourceTable.descriptionShort, // Match GameCard prop if needed
        steamAppid: externalSourceTable.steamAppid,
        tags: externalSourceTable.tags,
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

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
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

      <section>
        <h2 className="text-xl font-semibold mb-4">
          Library ({libraryGames?.length ?? 0})
        </h2>
        {libraryGames && libraryGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Use the actual GameCard component */}
            {libraryGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                // Determine if the game is in the *logged-in* user's library
                isInLibrary={loggedInUserLibraryIds.has(game.id)}
                onAddToLibrary={addToLibrary} // Pass server actions
                onRemoveFromLibrary={removeFromLibrary}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">This library is empty.</p>
        )}
      </section>
    </div>
  );
}

// Consider adding Revalidation if needed
// export const revalidate = 60; // Revalidate every 60 seconds
