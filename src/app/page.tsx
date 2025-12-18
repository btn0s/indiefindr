import { supabase } from "@/lib/supabase/server";
import { IngestForm } from "@/components/IngestForm";
import { RelatedGameCard } from "@/components/RelatedGameCard";
import {
  RerunAllButton,
  RerunAllProvider,
  RerunAllMessages,
} from "@/components/RerunAllButton";

type GameListItem = {
  id: number;
  name: string;
  header_image: string | null;
  videos: string[] | null;
};

async function getGames(): Promise<GameListItem[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("id, name, header_image, videos")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error loading games:", error);
    return [];
  }

  return (games || []) as GameListItem[];
}

export default async function Home() {
  const games = await getGames();

  return (
    <RerunAllProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-8">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold">Games Graph</h1>
            <p className="text-muted-foreground mb-2">
              Paste a Steam link to ingest game data and find similar games.
            </p>
            <IngestForm />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Ingested Games</h2>
              <RerunAllButton />
            </div>
            {games.length === 0 ? (
              <p className="text-muted-foreground">
                No games ingested yet. Start by ingesting a game above.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games.map((game) => (
                    <RelatedGameCard
                      key={game.id}
                      game={{
                        appid: game.id,
                        name: game.name,
                        header_image: game.header_image,
                        videos: game.videos,
                      }}
                    />
                  ))}
                </div>
                <RerunAllMessages />
              </>
            )}
          </div>
        </main>
      </div>
    </RerunAllProvider>
  );
}
