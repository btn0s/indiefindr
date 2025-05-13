import React from "react";
import { createClient } from "@/utils/supabase/server";
import {
  getLibraryGameIds,
  removeFromLibrary,
  addToLibrary,
} from "@/app/actions/library";
import { db, schema } from "@/db";
import { inArray, eq } from "drizzle-orm";
import { GameGrid } from "@/components/game-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGamesFoundByUser } from "@/app/actions/finds";

// Define the shape needed by GameGrid and GameCardMini (including rawData)
type LibraryGameForGrid = {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData: any | null; // Using any for now, ideally import SteamRawData
  foundByUsername?: string | null;
};

async function getUserLibraryGames(
  userId: string
): Promise<LibraryGameForGrid[]> {
  const libraryResult = await getLibraryGameIds();

  if (
    !libraryResult.success ||
    !libraryResult.data ||
    libraryResult.data.length === 0
  ) {
    return [];
  }

  const gameIds = libraryResult.data;

  try {
    const gamesFromDb = await db
      .select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        steamAppid: schema.externalSourceTable.steamAppid,
        rawData: schema.externalSourceTable.rawData, // Select the rawData field
      })
      .from(schema.externalSourceTable)
      .where(inArray(schema.externalSourceTable.id, gameIds))
      .execute();

    return gamesFromDb.map((game) => ({
      id: game.id,
      title: game.title,
      descriptionShort: game.descriptionShort,
      steamAppid: game.steamAppid,
      rawData: game.rawData, // Map rawData to the returned object
    }));
  } catch (error) {
    console.error("Error fetching library game details:", error);
    return [];
  }
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Please sign in to view your profile and library.</p>;
  }

  const libraryGames = await getUserLibraryGames(user.id);

  // Get the games found by the current user
  let foundGames: LibraryGameForGrid[] = [];
  try {
    const foundGamesResult = await getGamesFoundByUser(user.id);
    if (foundGamesResult.success && foundGamesResult.data) {
      foundGames = foundGamesResult.data as LibraryGameForGrid[];
    }
  } catch (error) {
    console.error("Error fetching user's found games:", error);
  }

  // Prepare the set of IDs for GameGrid (all games on this page are in the library)
  const loggedInUserLibraryIds = new Set<number>(libraryGames.map((g) => g.id));

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Collection</h1>

      <Tabs defaultValue="library" className="mt-6">
        <TabsList className="mb-4">
          <TabsTrigger value="library">
            Library ({libraryGames.length})
          </TabsTrigger>
          <TabsTrigger value="finds" disabled={foundGames.length === 0}>
            Finds ({foundGames.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          {libraryGames.length === 0 ? (
            <p className="text-muted-foreground">
              Your library is empty. Discover games and add them!
            </p>
          ) : (
            <GameGrid
              games={libraryGames}
              loggedInUserLibraryIds={loggedInUserLibraryIds}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
            />
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
            <p className="text-muted-foreground">
              You haven't found any games yet.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
