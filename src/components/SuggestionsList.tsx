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
import { ingest } from "@/lib/ingest";

interface SuggestionsListProps {
  appid: number;
}

const MIN_SUGGESTIONS = 6;
const STALE_DAYS = 7;

/**
 * Auto-fetch Steam data for suggested games that don't exist in DB.
 */
async function autoFetchMissingSteamData(
  suggestedAppIds: number[],
  existingAppIds: Set<number>
): Promise<void> {
  const missingAppIds = suggestedAppIds.filter((id) => !existingAppIds.has(id));
  if (missingAppIds.length === 0) return;

  console.log(`[SUGGESTIONS LIST] Auto-fetching ${missingAppIds.length} missing games`);

  for (const appId of missingAppIds) {
    try {
      await ingest(`https://store.steampowered.com/app/${appId}/`, true);
    } catch (err) {
      console.error(`[SUGGESTIONS LIST] Failed to fetch ${appId}`);
    }
  }
}

function shouldRegenerate(count: number, updatedAt: string | null): boolean {
  // Never updated? Regenerate.
  if (!updatedAt) return true;

  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);

  // Less than 6 suggestions? Regenerate.
  if (count < MIN_SUGGESTIONS) return true;

  // Stale (>7 days)? Regenerate.
  if (days >= STALE_DAYS) return true;

  return false;
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

  if (gameData && shouldRegenerate(suggestions.length, gameData.updated_at)) {
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

        console.log(`[SUGGESTIONS LIST] Regenerating for ${appid} (${suggestions.length} suggestions)`);
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

  // Auto-fetch Steam data for missing suggested games (runs in background)
  const existingAppIds = new Set(cachedGames.map((g) => g.appid));
  autoFetchMissingSteamData(suggestedAppIds, existingAppIds).catch((err) => {
    console.error("[SUGGESTIONS LIST] Error in auto-fetch:", err);
  });

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
