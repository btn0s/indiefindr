import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew, Suggestion } from "@/lib/supabase/types";
import { suggestGames } from "@/lib/suggest";

interface SuggestionsListProps {
  appid: number;
}

// How many suggestions we consider "full" (don't regenerate if we have this many)
const MIN_SUGGESTIONS_TARGET = 8;
// How old (in days) before we consider suggestions stale
const STALE_DAYS = 7;

function shouldRegenerateSuggestions(
  suggestionsCount: number,
  updatedAt: string | null
): boolean {
  // Always regenerate if we have 0-1 suggestions (likely failed or incomplete)
  if (suggestionsCount <= 1) {
    return true;
  }

  // If we have a good number of suggestions, don't regenerate
  if (suggestionsCount >= MIN_SUGGESTIONS_TARGET) {
    return false;
  }

  // For 2-7 suggestions: only regenerate if stale (older than STALE_DAYS)
  if (!updatedAt) {
    return true; // No timestamp, treat as stale
  }

  const updatedDate = new Date(updatedAt);
  const now = new Date();
  const daysSinceUpdate =
    (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceUpdate >= STALE_DAYS;
}

export async function SuggestionsList({ appid }: SuggestionsListProps) {
  // Fetch suggestions from cache (simple SQL query)
  const { data: gameData } = await supabase
    .from("games_new")
    .select(
      "suggested_game_appids, screenshots, title, short_description, long_description, updated_at"
    )
    .eq("appid", appid)
    .maybeSingle();

  let suggestions: Suggestion[] = gameData?.suggested_game_appids || [];

  // Check if we should regenerate suggestions based on count and staleness
  const shouldRegenerate =
    gameData &&
    shouldRegenerateSuggestions(suggestions.length, gameData.updated_at);

  if (shouldRegenerate && gameData) {
    try {
      if (gameData.screenshots && gameData.screenshots.length > 0) {
        const firstScreenshot = gameData.screenshots[0];
        const textContext = [
          gameData.title,
          gameData.short_description,
          gameData.long_description,
        ]
          .filter(Boolean)
          .join(". ");

        const reason =
          suggestions.length <= 1
            ? "too few"
            : `stale (${suggestions.length} < ${MIN_SUGGESTIONS_TARGET})`;
        console.log(
          `[SUGGESTIONS LIST] Generating suggestions for appid: ${appid} (${reason})`
        );
        const result = await suggestGames(firstScreenshot, textContext);

        // Find games that already suggest this game (bidirectional linking)
        // Note: This query needs to check if any suggestion object has appId matching
        const { data: reverseLinks } = await supabase
          .from("games_new")
          .select("appid")
          .not("suggested_game_appids", "is", null);

        // Filter reverse links - games that have this appid in their suggestions
        const reverseLinkAppIds = (reverseLinks || [])
          .filter((g) => {
            // We need to re-query to get the actual suggested_game_appids
            return false; // Skip for now, will be handled by refresh
          })
          .map((g) => g.appid);

        // Merge: new suggestions + existing (deduplicated by appId)
        const existingSuggestions: Suggestion[] =
          gameData.suggested_game_appids || [];
        const newSuggestions = result.suggestions;

        // Create a map to deduplicate by appId, preferring new suggestions (fresher explanations)
        const suggestionMap = new Map<number, Suggestion>();
        for (const s of existingSuggestions) {
          suggestionMap.set(s.appId, s);
        }
        for (const s of newSuggestions) {
          suggestionMap.set(s.appId, s);
        }
        const mergedSuggestions = Array.from(suggestionMap.values());

        // Save validated suggestions to DB cache
        await supabase
          .from("games_new")
          .update({
            suggested_game_appids: mergedSuggestions,
            updated_at: new Date().toISOString(),
          })
          .eq("appid", appid);

        // Add this game to each suggested game's list (make it bidirectional)
        for (const suggestion of newSuggestions) {
          const { data: suggestedGame } = await supabase
            .from("games_new")
            .select("suggested_game_appids")
            .eq("appid", suggestion.appId)
            .maybeSingle();

          if (suggestedGame) {
            const theirSuggestions: Suggestion[] =
              suggestedGame.suggested_game_appids || [];
            const alreadyHasLink = theirSuggestions.some(
              (s) => s.appId === appid
            );
            if (!alreadyHasLink) {
              await supabase
                .from("games_new")
                .update({
                  suggested_game_appids: [
                    ...theirSuggestions,
                    { appId: appid, explanation: "Suggested by similar game" },
                  ],
                  updated_at: new Date().toISOString(),
                })
                .eq("appid", suggestion.appId);
            }
          }
        }

        suggestions = mergedSuggestions;
      }
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to generate suggestions:",
        error
      );
      // Continue and show empty state
    }
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No suggestions available yet</CardDescription>
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

  // Build a map of appId -> explanation for quick lookup
  const explanationMap = new Map(
    suggestions.map((s) => [s.appId, s.explanation])
  );

  // Only show games that exist in DB - don't try to stream missing ones (causes 429s)
  const sortedGames = suggestions
    .map((suggestion) => {
      const game = cachedGames.find((g) => g.appid === suggestion.appId);
      return game
        ? { ...game, explanation: suggestion.explanation }
        : undefined;
    })
    .filter((g): g is GameNew & { explanation: string } => g !== undefined);

  if (sortedGames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>
            No games found in database yet. Click "Load more" to discover
            similar games.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Render only cached games in suggested order with explanations
  return (
    <div className="grid grid-cols-3 gap-6">
      {sortedGames.map((game) => (
        <GameCard key={game.appid} {...game} />
      ))}
    </div>
  );
}
