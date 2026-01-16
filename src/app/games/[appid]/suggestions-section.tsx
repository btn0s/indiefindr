import { Suspense } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameCardAsync } from "@/components/GameCardAsync";
import { GameCard } from "@/components/GameCard";
import { SuggestionsPoller } from "./suggestions-poller";

type Suggestion = {
  suggested_appid: number;
  reason: string;
};

async function getSuggestions(appId: number): Promise<Suggestion[]> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appId);

  return data ?? [];
}

async function SuggestionsContent({ appId }: { appId: number }) {
  const suggestions = await getSuggestions(appId);
  const hasSuggestions = suggestions.length > 0;

  if (!hasSuggestions) {
    return <SuggestionsPoller appId={appId} />;
  }

  // Batch fetch all suggested game data in one query
  const suggestedAppIds = suggestions.map((s) => s.suggested_appid);
  const supabase = await getSupabaseServerClient();
  const { data: games } = await supabase
    .from("games_new")
    .select("appid, title, header_image")
    .in("appid", suggestedAppIds);

  const gamesMap = new Map(
    (games || []).map((g) => [
      g.appid,
      { appid: g.appid, title: g.title, header_image: g.header_image },
    ])
  );

  const suggestedGameData = suggestions.map((s) => ({
    appid: s.suggested_appid,
    reason: s.reason,
    game: gamesMap.get(s.suggested_appid) || null,
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {suggestedGameData.map((s) =>
        s.game ? (
          <GameCard
            key={s.appid}
            appid={s.game.appid}
            title={s.game.title}
            header_image={s.game.header_image}
            explanation={s.reason}
          />
        ) : (
          <Suspense key={s.appid} fallback={<SuggestionCardSkeleton />}>
            <GameCardAsync appid={s.appid} explanation={s.reason} />
          </Suspense>
        )
      )}
    </div>
  );
}

function SuggestionsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
          <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function SuggestionCardSkeleton() {
  return (
    <div>
      <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
      <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
      <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
    </div>
  );
}

export function SuggestionsSection({ appId, gameTitle }: { appId: number; gameTitle: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Games like {gameTitle}</h2>
      <Suspense fallback={<SuggestionsSkeleton />}>
        <SuggestionsContent appId={appId} />
      </Suspense>
    </div>
  );
}
