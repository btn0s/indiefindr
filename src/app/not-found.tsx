import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameCardAsync } from "@/components/GameCardAsync";
import { getPinnedHomeCollections } from "@/lib/collections";
import { GameRow } from "@/components/GameRow";

const PAGE_SIZE = 24;

export default async function NotFound() {
  const supabase = getSupabaseServerClient();
  const [{ data, error }, pinnedCollections] = await Promise.all([
    supabase
      .from("games_new_home")
      .select("appid")
      .order("home_bucket", { ascending: true })
      .order("suggestions_count", { ascending: false })
      .order("created_at", { ascending: false })
      .order("appid", { ascending: true })
      .range(0, PAGE_SIZE - 1),
    getPinnedHomeCollections(),
  ]);

  const appids: number[] = error ? [] : (data || []).map((g) => g.appid);

  if (error) {
    console.error("Error loading games:", error);
  }

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="container mx-auto max-w-4xl w-full">
        <div className="flex flex-col items-center justify-center gap-4 text-center py-8">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Game Not Found
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            This game doesn&apos;t exist on Steam or hasn&apos;t been added yet. Browse games below or search for a different game.
          </p>
        </div>
      </div>

      <hr className="border-border" />

      {pinnedCollections.length > 0 && (
        <GameRow collections={pinnedCollections} />
      )}

      <div className="flex flex-col gap-4 w-full">
        <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">All Games</h2>
        </div>
        <div className="container mx-auto max-w-4xl w-full">
          {appids.length === 0 ? (
            <p className="text-muted-foreground">
              No games ingested yet. Search for a game above to add your first
              one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {appids.map((appid) => (
                <GameCardAsync key={appid} appid={appid} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
