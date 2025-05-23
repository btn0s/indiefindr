import React from "react";
import { createClient } from "@/lib/supabase/server"; // Use standard server client
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Metadata, ResolvingMetadata } from "next"; // Import Metadata types
// import { Database } from "@/lib/database.types"; // Removed - Use Drizzle types implicitly
import { GameGrid } from "@/components/game/game-grid"; // Import GameGrid
import { profilesTable, libraryTable, gamesTable } from "@/lib/db/schema"; // Import schema tables
import { db } from "@/lib/db"; // Import Drizzle instance
import { eq, and, sql, count } from "drizzle-orm";
import type { SteamRawData } from "@/types/steam"; // Import SteamRawData type
import { addToLibrary, removeFromLibrary } from "@/app/(api)/actions/library"; // Import library actions for GameCard
// import { getGamesFoundByUser } from "@/app/(api)/actions/finds"; // Import the new action <-- REMOVE THIS
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { DrizzleUserRepository } from "@/lib/repositories/user-repository"; // <-- Import UserRepository
import type { GameCardViewModel } from "@/lib/services/game-service"; // <-- GameCardViewModel from game-service
import type { Profile } from "@/lib/repositories/user-repository"; // <-- Profile from user-repository
import { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // <-- ADD THIS
import { DefaultGameService } from "@/lib/services/game-service"; // <-- ADD THIS
// Note: Profile type might come from user-repository.ts itself after this change.
// For now, assuming GameService might expose a general Profile type or we use the one from user-repository.

// Helper function for initials remains the same
const getUserInitials = (name?: string | null) => {
  if (!name) return "?";
  const names = name.split(" ");
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

type ProfilePageProps = {
  params: Promise<{ usernameOrGameId: string }>;
};

// Define the type required by GameGrid
// type GameForGrid = {
//   // Renamed for clarity, as it's used by both grids now
//   id: number;
//   title: string | null;
//   steamAppid: string | null;
//   descriptionShort: string | null;
//   rawData?: SteamRawData | null; // Added for raw game data
//   foundByUsername?: string | null; // Added for "Finds" section
// }; // <-- REMOVE THIS TYPE

// --- Generate Metadata Function ---
export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const username = decodeURIComponent((await params).usernameOrGameId);

  try {
    const profile = await db
      .select({
        id: profilesTable.id,
        username: profilesTable.username,
        bio: profilesTable.bio,
        avatarUrl: profilesTable.avatarUrl,
      })
      .from(profilesTable)
      .where(eq(profilesTable.username, username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!profile) {
      return getDefaultMetadata();
    }

    const findsCount = await db
      .select({ count: count() })
      .from(gamesTable)
      .where(eq(gamesTable.foundBy, profile.id))
      .then((rows) => Number(rows[0]?.count) || 0);

    const title = `${profile.username} on IndieFindr`;
    const description = `${findsCount} games found so far! Join the community to find your next favorite indie game.`;
    const imageUrl = profile.avatarUrl ?? "/og.png";

    return {
      title,
      description,
      openGraph: { title, description, images: [{ url: imageUrl }] },
      twitter: {
        title,
        description,
        card: "summary_large_image",
        images: [{ url: imageUrl }],
      },
    };
  } catch (error) {
    console.error("Metadata fetch error:", error);
    return getDefaultMetadata();
  }
}

function getDefaultMetadata(): Metadata {
  const title = "User Profile | IndieFindr";
  const description = "View user profiles on IndieFindr.";

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: {
      title,
      description,
      card: "summary",
    },
  };
}
// --- End Generate Metadata Function ---

// Instantiate repositories
const userRepository = new DrizzleUserRepository();
const gameRepository = new DrizzleGameRepository(); // <-- ADD THIS
const gameService = new DefaultGameService(); // <-- ADD THIS

export default async function ProfilePage({ params }: ProfilePageProps) {
  // Correctly instantiate the server client
  const supabase = await createClient();
  const p = await params;
  const decodedUsernameOrGameId = decodeURIComponent(p.usernameOrGameId);

  // 1. Fetch the profile user's data using UserRepository
  let profileData: Profile | null = null; // <-- Use Profile type from user-repository
  try {
    // const result = await db
    //   .select()
    //   .from(profilesTable)
    //   .where(eq(profilesTable.username, decodedUsernameOrGameId))
    //   .limit(1);
    profileData = await userRepository.getByUsername(decodedUsernameOrGameId);

    if (!profileData) {
      notFound();
    }
    // profileData = result[0]; // No longer needed
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
  let libraryGames: GameCardViewModel[] = []; // <-- Use GameCardViewModel
  if (profileData?.id) {
    // Ensure profileData and its id are available
    try {
      // This part still fetches raw game data for library, then transforms.
      // It could potentially also use a method in GameRepository if we move the raw fetch there.
      // For now, keeping the direct DB query for library game details as it involves a join.
      const libraryGameDetails = await db
        .select({
          id: gamesTable.id,
          title: gamesTable.title,
          descriptionShort: gamesTable.descriptionShort, // Correct field name
          steamAppid: gamesTable.steamAppid,
          rawData: sql<SteamRawData | null>`${gamesTable.rawData}`,
          // Add all fields required by Game type for GameService transformation
          platform: gamesTable.platform,
          externalId: gamesTable.externalId,
          developer: gamesTable.developer,
          descriptionDetailed: gamesTable.descriptionDetailed,
          genres: gamesTable.genres,
          tags: gamesTable.tags,
          embedding: gamesTable.embedding,
          enrichmentStatus: gamesTable.enrichmentStatus,
          isFeatured: gamesTable.isFeatured,
          lastFetched: gamesTable.lastFetched,
          createdAt: gamesTable.createdAt,
          foundBy: gamesTable.foundBy, // This is game.foundBy, not profile user
        })
        .from(libraryTable)
        .innerJoin(gamesTable, eq(libraryTable.gameRefId, gamesTable.id))
        .where(eq(libraryTable.userId, profileData.id));

      // Instantiate GameService here to transform libraryGameDetails
      libraryGames = gameService.toGameCardViewModels(
        libraryGameDetails as any[]
      ); // Cast as any[] for now
    } catch (error) {
      console.error("Library fetch error:", error);
      // Handle error appropriately, maybe show an empty library section or log
    }
  }

  // 4. Get the IDs of games in the *logged-in* user's library for the GameCard buttons
  let loggedInUserLibraryIds = new Set<number>();
  if (loggedInUserId) {
    try {
      // const libraryResult = await getLibraryGameIds(); // Uses server action for the logged-in user
      // if (libraryResult.success && libraryResult.data) {
      //   loggedInUserLibraryIds = new Set(libraryResult.data);
      // }
      const ids = await userRepository.getLibraryGameIds(loggedInUserId);
      loggedInUserLibraryIds = new Set(ids);
    } catch (error) {
      console.error("Failed to get logged-in user library IDs:", error);
    }
  }

  // 5. Fetch games found by the profile user
  let foundGames: GameCardViewModel[] = []; // <-- Use GameCardViewModel
  if (profileData?.id) {
    try {
      // const foundGamesResult = await getGamesFoundByUser(profileData.id);
      // if (foundGamesResult.success && foundGamesResult.data) {
      //   // Explicitly cast to GameForGrid[] if necessary, though action's FoundGame type should align
      //   foundGames = foundGamesResult.data as GameForGrid[];
      // } else {
      //   console.warn(
      //     "Failed to fetch games found by user:",
      //     foundGamesResult.error
      //   );
      // }
      const rawFoundGames = await gameRepository.getByUser(profileData.id);
      foundGames = gameService.toGameCardViewModels(rawFoundGames);
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
