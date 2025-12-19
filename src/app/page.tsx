import { supabase } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import { GameNew } from "@/lib/supabase/types";

async function getGames(): Promise<GameNew[]> {
  const { data: games, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
    )
    .limit(100);

  if (error) {
    console.error("Error loading games:", error);
    return [];
  }

  // Sort by number of suggestions (most first), then by created_at as tiebreaker
  const sorted = (games || []).sort((a, b) => {
    const aCount = Array.isArray(a.suggested_game_appids) ? a.suggested_game_appids.length : 0;
    const bCount = Array.isArray(b.suggested_game_appids) ? b.suggested_game_appids.length : 0;
    
    if (bCount !== aCount) {
      return bCount - aCount; // Most suggestions first
    }
    
    // Tiebreaker: most recently created first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sorted as GameNew[];
}

export default async function Home() {
  const games = await getGames();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Navbar />
      <main className="flex flex-col gap-8 pt-8">
        {/* Full-width grid section */}
        <div className="flex flex-col gap-4 w-full px-4 pb-8">
          <div className="container mx-auto max-w-7xl w-full flex items-center justify-between">
            <h2 className="font-semibold text-xl">All Games</h2>
          </div>
          {games.length === 0 ? (
            <div className="container mx-auto max-w-7xl w-full">
              <p className="text-muted-foreground">
                No games ingested yet. Click "Add Game" in the navbar to get started.
              </p>
            </div>
          ) : (
            <>
              <div className="container mx-auto w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {games.map((game) => (
                    <GameCard key={game.appid} {...game} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
