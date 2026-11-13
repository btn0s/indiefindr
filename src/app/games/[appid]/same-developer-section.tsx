import { Suspense } from "react";
import { ShelfHeading } from "@/components/ShelfHeading";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameCard } from "@/components/GameCard";
import type { GameCardGame } from "@/lib/supabase/types";

async function SameDeveloperContent({
  appId,
  developers,
}: {
  appId: number;
  developers: string[];
}) {
  if (developers.length === 0) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  // Find games from the same developer(s), excluding the current game
  // Use PostgREST cs (contains) operator: check if developers array contains any developer
  // For multiple developers, use OR logic
  const developerFilters = developers
    .map((dev) => `developers.cs.{${dev}}`)
    .join(",");

  const gamesResult = await supabase.from("games")
    .select("appid, title, header_image")
    .neq("appid", appId).eq("is_indie", true).or(developerFilters)
    .order("release_date", { ascending: false }).limit(4);

  const games = gamesResult.data;

  if (!games || games.length === 0) {
    return null;
  }

  const gameCards: GameCardGame[] = games.map((g) => ({
    appid: g.appid,
    title: g.title,
    header_image: g.header_image,
  }));

  return (
    <section>
      <ShelfHeading title={`More from ${developers.length === 1 ? developers[0] : "these developers"}`}
        href={developers.length === 1 ? `/developer/${encodeURIComponent(developers[0])}` : undefined} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6">
        {gameCards.map((game) => <GameCard key={game.appid} {...game} />)}
      </div>
    </section>
  );
}

function SameDeveloperSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="container mx-auto max-w-4xl w-full flex flex-col gap-1">
        <div className="h-7 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div className="container mx-auto max-w-4xl w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SameDeveloperSection({
  appId,
  developers,
}: {
  appId: number;
  developers: string[];
}) {
  if (developers.length === 0) {
    return null;
  }

  return (
    <Suspense fallback={<SameDeveloperSkeleton />}>
      <SameDeveloperContent appId={appId} developers={developers} />
    </Suspense>
  );
}
