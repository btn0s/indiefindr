import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export default async function NotFound() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new_home")
    .select("appid, title, header_image")
    .order("home_bucket", { ascending: true })
    .order("created_at", { ascending: false })
    .order("appid", { ascending: true })
    .range(0, PAGE_SIZE - 1);

  const games: GameCardGame[] = error
    ? []
    : (data || [])
        .filter((g): g is typeof g & { appid: number; title: string } =>
          g.appid !== null && g.title !== null
        )
        .map((g) => ({
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
        }));

  if (error) {
    console.error("Error loading games:", error);
  }

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2 py-8">
        <h1 className="text-4xl font-semibold tracking-tight">Not Found</h1>
        <p className="text-muted-foreground">
          This page doesn&apos;t exist. Browse games below or search for
          something else.
        </p>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Discover Games</h2>
        {games.length === 0 ? (
          <p className="text-muted-foreground">
            No games yet. Search for a game above to add your first one.
          </p>
        ) : (
          <GameGrid initialGames={games} />
        )}
      </div>
    </main>
  );
}
