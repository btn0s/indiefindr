import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GamesGrid } from "@/components/GamesGrid";
import type { GameCardGame } from "@/lib/supabase/types";
import { getPinnedHomeCollections } from "@/lib/collections";
import { CollectionsSection } from "@/components/CollectionsSection";

const PAGE_SIZE = 24;

export default async function NotFound() {
  const supabase = getSupabaseServerClient();
  const [{ data, error }, pinnedCollections] = await Promise.all([
    supabase
      .from("games_new_home")
      .select("appid, title, header_image, videos")
      .order("home_bucket", { ascending: true })
      .order("suggestions_count", { ascending: false })
      .order("created_at", { ascending: false })
      .order("appid", { ascending: true })
      .range(0, PAGE_SIZE - 1),
    getPinnedHomeCollections(),
  ]);

  const games: GameCardGame[] = error
    ? []
    : ((data || []).map((g) => ({
        appid: g.appid,
        title: g.title,
        header_image: g.header_image,
        videos: g.videos,
      })) satisfies GameCardGame[]);

  if (error) {
    console.error("Error loading games:", error);
  }

  return (
    <main className="flex flex-col gap-8 pt-8">
      {/* 404 Message */}
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

      {/* Pinned Collections Section */}
      {pinnedCollections.length > 0 && (
        <CollectionsSection collections={pinnedCollections} />
      )}

      {/* Full-width grid section */}
      <div className="flex flex-col gap-4 w-full">
        <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">All Games</h2>
        </div>
        <div className="container mx-auto max-w-4xl w-full">
          {games.length === 0 ? (
            <p className="text-muted-foreground">
              No games ingested yet. Search for a game above to add your first
              one.
            </p>
          ) : (
            <GamesGrid initialGames={games} />
          )}
        </div>
      </div>
    </main>
  );
}
