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
    .select("suggested_game_appids, screenshots, title, short_description, long_description")
    .eq("appid", appid)
    .maybeSingle();

  let suggestedAppIds = gameData?.suggested_game_appids || null;

  // If no cached suggestions exist, generate them (this will block, but only on first load)
  if (!suggestedAppIds && gameData) {
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

        // Save validated app IDs to DB cache
        await supabase
          .from("games_new")
          .update({
            suggested_game_appids: suggestions.validatedAppIds,
            updated_at: new Date().toISOString(),
          })
          .eq("appid", appid);

        suggestedAppIds = suggestions.validatedAppIds;
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

  // Simple SQL query: fetch games by app IDs
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

  const gamesList = (games || []) as GameNew[];

  if (gamesList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No games found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Render games
  return (
    <div className="grid grid-cols-3 gap-6">
      {gamesList.map((game) => (
        <GameCard key={game.appid} {...game} />
      ))}
    </div>
  );
}



