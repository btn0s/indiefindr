import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew } from "@/lib/supabase/types";
import { suggestGames } from "@/lib/suggest";

interface SuggestionsListProps {
  appid: number;
}

export async function SuggestionsList({ appid }: SuggestionsListProps) {
  // Fetch suggested app IDs from cache (simple SQL query)
  const { data: gameData } = await supabase
    .from("games_new")
    .select(
      "suggested_game_appids, screenshots, title, short_description, long_description"
    )
    .eq("appid", appid)
    .maybeSingle();

  let suggestedAppIds: number[] = gameData?.suggested_game_appids || [];

  // If no cached suggestions exist, generate them (this will block, but only on first load)
  if (suggestedAppIds.length === 0 && gameData) {
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

        console.log(
          "[SUGGESTIONS LIST] Generating suggestions for appid:",
          appid
        );
        const suggestions = await suggestGames(firstScreenshot, textContext);

        // Find games that already suggest this game (bidirectional linking)
        const { data: reverseLinks } = await supabase
          .from("games_new")
          .select("appid")
          .contains("suggested_game_appids", [appid]);

        const reverseLinkAppIds = (reverseLinks || []).map((g) => g.appid);

        // Merge: new suggestions + reverse links + existing (deduplicated)
        const existingAppIds: number[] = gameData.suggested_game_appids || [];
        const newAppIds = suggestions.validatedAppIds;
        const mergedAppIds = [...new Set([...newAppIds, ...reverseLinkAppIds, ...existingAppIds])];

        // Save validated app IDs to DB cache
        await supabase
          .from("games_new")
          .update({
            suggested_game_appids: mergedAppIds,
            updated_at: new Date().toISOString(),
          })
          .eq("appid", appid);

        // Add this game to each suggested game's list (make it bidirectional)
        for (const suggestedAppId of newAppIds) {
          const { data: suggestedGame } = await supabase
            .from("games_new")
            .select("suggested_game_appids")
            .eq("appid", suggestedAppId)
            .maybeSingle();

          if (suggestedGame) {
            const theirSuggestions: number[] = suggestedGame.suggested_game_appids || [];
            if (!theirSuggestions.includes(appid)) {
              await supabase
                .from("games_new")
                .update({
                  suggested_game_appids: [...theirSuggestions, appid],
                  updated_at: new Date().toISOString(),
                })
                .eq("appid", suggestedAppId);
            }
          }
        }

        suggestedAppIds = mergedAppIds;
      }
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to generate suggestions:",
        error
      );
      // Continue and show empty state
    }
  }

  if (!suggestedAppIds || suggestedAppIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No suggestions available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

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

  // Only show games that exist in DB - don't try to stream missing ones (causes 429s)
  const sortedGames = suggestedAppIds
    .map((appId) => cachedGames.find((g) => g.appid === appId))
    .filter((g): g is GameNew => g !== undefined);

  if (sortedGames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No games found in database yet. Click "Load more" to discover similar games.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Render only cached games in suggested order
  return (
    <div className="grid grid-cols-3 gap-6">
      {sortedGames.map((game) => (
        <GameCard key={game.appid} {...game} />
      ))}
    </div>
  );
}
