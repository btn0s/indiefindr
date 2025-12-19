import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew, Suggestion } from "@/lib/supabase/types";
import { ingest } from "@/lib/ingest";

interface SuggestionsListProps {
  appid: number;
}

const MIN_SUGGESTIONS = 6;

/**
 * Auto-fetch Steam data for suggested games that don't exist in DB.
 * Runs in background - doesn't block render.
 */
async function autoFetchMissingSteamData(
  suggestedAppIds: number[],
  existingAppIds: Set<number>
): Promise<void> {
  const missingAppIds = suggestedAppIds.filter((id) => !existingAppIds.has(id));
  if (missingAppIds.length === 0) return;

  console.log(
    `[SUGGESTIONS LIST] Auto-fetching ${missingAppIds.length} missing games`
  );

  for (const appId of missingAppIds) {
    try {
      // skipSuggestions=true: only fetch Steam data
      await ingest(`https://store.steampowered.com/app/${appId}/`, true);
    } catch (err) {
      console.error(`[SUGGESTIONS LIST] Failed to fetch ${appId}`);
    }
  }
}

export async function SuggestionsList({ appid }: SuggestionsListProps) {
  // Fetch suggestions from cache (fast DB query only)
  const { data: gameData } = await supabase
    .from("games_new")
    .select("suggested_game_appids")
    .eq("appid", appid)
    .maybeSingle();

  const suggestions: Suggestion[] = gameData?.suggested_game_appids || [];

  // No suggestions? Show empty state with prompt to load
  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>
            Click "Load more" to discover similar games.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Extract app IDs for fetching
  const suggestedAppIds = suggestions.map((s) => s.appId);

  // Fetch games that already exist in DB
  const { data: games, error } = await supabase
    .from("games_new")
    .select("*")
    .in("appid", suggestedAppIds);

  if (error) {
    console.error("[SUGGESTIONS LIST] Failed to fetch games:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>Error loading suggestions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Filter out DLCs from cached games
  const cachedGames = ((games || []) as GameNew[]).filter((g) => {
    const rawType = (g.raw as { type?: string })?.type;
    return rawType === "game" || !rawType; // Allow if type is "game" or missing
  });

  // Auto-fetch Steam data for missing suggested games (runs in background)
  const existingAppIds = new Set(cachedGames.map((g) => g.appid));
  autoFetchMissingSteamData(suggestedAppIds, existingAppIds).catch((err) => {
    console.error("[SUGGESTIONS LIST] Error in auto-fetch:", err);
  });

  // Only show games that exist in DB
  const sortedGames = suggestions
    .map((suggestion) => {
      const game = cachedGames.find((g) => g.appid === suggestion.appId);
      return game
        ? { ...game, explanation: suggestion.explanation }
        : undefined;
    })
    .filter((g): g is GameNew & { explanation: string } => g !== undefined);

  // Few or no displayable games? Show what we have + message
  if (sortedGames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>
            {suggestions.length} games found, loading details... Click "Load
            more" to refresh.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasMoreToLoad =
    sortedGames.length < suggestions.length ||
    suggestions.length < MIN_SUGGESTIONS;

  // Render cached games in suggested order with explanations
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-6">
        {sortedGames.map((game) => (
          <GameCard key={game.appid} {...game} />
        ))}
      </div>
      {hasMoreToLoad && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {sortedGames.length} of {suggestions.length} suggestions.
          Click "Load more" to discover more.
        </p>
      )}
    </div>
  );
}
