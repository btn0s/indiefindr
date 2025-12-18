import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import { IngestForm } from "@/components/IngestForm";

type GameListItem = {
  id: number;
  name: string;
};

async function getGames(): Promise<GameListItem[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("id, name")
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Games Graph</h1>
          <p className="text-muted-foreground">
            Paste a Steam link to ingest game data and find similar games.
          </p>
        </div>

        <IngestForm />

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Ingested Games</h2>
          {games.length === 0 ? (
            <p className="text-muted-foreground">
              No games ingested yet. Start by ingesting a game above.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {games.map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/games/${game.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {game.name} ({game.id})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
