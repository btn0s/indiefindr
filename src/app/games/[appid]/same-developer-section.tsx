import { Suspense } from "react";
import Link from "next/link";
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

  const supabase = await getSupabaseServerClient();

  // Find games from the same developer(s), excluding the current game
  // Use PostgREST cs (contains) operator: check if developers array contains any developer
  // For multiple developers, use OR logic
  const developerFilters = developers
    .map((dev) => `developers.cs.{${dev}}`)
    .join(",");

  // Get games and count in parallel
  const [gamesResult, countResult] = await Promise.all([
    supabase
      .from("games_new")
      .select("appid, title, header_image")
      .neq("appid", appId)
      .or(developerFilters)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("games_new")
      .select("*", { count: "exact", head: true })
      .neq("appid", appId)
      .or(developerFilters),
  ]);

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
    <div className="flex flex-col gap-4 w-full">
      <div className="container mx-auto max-w-4xl w-full flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-xl">
            More from{" "}
            {developers.length === 1 ? developers[0] : "these developers"}
          </h2>
          {developers.length === 1 && (
            <Link
              href={`/developer/${encodeURIComponent(developers[0])}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              prefetch={true}
            >
              View all →
            </Link>
          )}
        </div>
      </div>
      <div className="container mx-auto max-w-4xl w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {gameCards.map((game, index) => (
            <GameCard
              key={game.appid}
              appid={game.appid}
              title={game.title}
              header_image={game.header_image}
              priority={index < 4}
            />
          ))}
        </div>
      </div>
    </div>
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
