import { CARD_FIELDS } from "@/lib/catalog";
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
    .select(CARD_FIELDS)
    .neq("appid", appId).eq("is_indie", true).or(developerFilters)
    .order("release_date", { ascending: false }).limit(4);

  const games = gamesResult.data;

  if (!games || games.length === 0) {
    return null;
  }

  const gameCards: GameCardGame[] = games;

  return (
    <section>
      <ShelfHeading title={`More from ${developers.length === 1 ? developers[0] : "these developers"}`}
        href={developers.length === 1 ? `/developer/${encodeURIComponent(developers[0])}` : undefined} />
      <div className="game-grid">
        {gameCards.map((game) => <GameCard key={game.appid} {...game} />)}
      </div>
    </section>
  );
}

function SameDeveloperSkeleton() {
  return (
    <section aria-hidden="true">
      <div className="section-heading"><div className="h-6 w-56 rounded bg-muted animate-pulse" /></div>
      <div className="game-grid">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="game-card-art animate-pulse" />)}
      </div>
    </section>
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
