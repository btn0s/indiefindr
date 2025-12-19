import { supabase } from "@/lib/supabase/server";
import { IngestForm } from "@/components/IngestForm";
import GameCard from "@/components/GameCard";
import {
  RerunAllButton,
  RerunAllProvider,
  RerunAllMessages,
} from "@/components/RerunAllButton";
import { GameNew } from "@/lib/supabase/types";

async function getGames(): Promise<GameNew[]> {
  const { data: games, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error loading games:", error);
    return [];
  }

  return (games || []) as GameNew[];
}

export default async function Home() {
  const games = await getGames();

  return (
    <RerunAllProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="flex flex-col gap-8">
          {/* Header section with max-width for readability */}
          <div className="container mx-auto max-w-4xl px-4 pt-8">
            <div className="flex flex-col">
              <h1 className="text-lg font-bold">Games Graph</h1>
              <p className="text-muted-foreground mb-2">
                Paste a Steam link to ingest game data and find similar games.
              </p>
              <IngestForm />
            </div>
          </div>

          {/* Full-width grid section */}
          <div className="flex flex-col gap-4 w-full px-4 pb-8">
            <div className="container mx-auto max-w-7xl w-full flex items-center justify-between">
              <h2 className="font-semibold">All Games</h2>
              <RerunAllButton />
            </div>
            {games.length === 0 ? (
              <div className="container mx-auto max-w-7xl w-full">
                <p className="text-muted-foreground">
                  No games ingested yet. Start by ingesting a game above.
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
                <div className="container mx-auto max-w-7xl w-full">
                  <RerunAllMessages />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </RerunAllProvider>
  );
}
