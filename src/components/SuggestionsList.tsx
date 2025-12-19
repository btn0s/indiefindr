import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew, ParsedSuggestionItem } from "@/lib/supabase/types";
import {
  fetchAndSaveSuggestedGames,
  extractAppIdsFromSuggestions,
} from "@/lib/ingest/suggestedGames";
import { suggestGames } from "@/lib/suggest";

interface SuggestionsListProps {
  appid: number;
}

/**
 * Parse the suggestions text from Perplexity - expects format: title, steam_appid, explanation
 */
function parseSuggestions(text: string): ParsedSuggestionItem[] {
  const items: ParsedSuggestionItem[] = [];

  // Split by newlines
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.match(/^(title|example|format)/i)); // Skip header lines

  for (const line of lines) {
    // Parse format: title, steam_appid, explanation
    // Handle commas that might be in the title or explanation by splitting carefully
    const parts = line.split(",").map((p) => p.trim());
    
    if (parts.length >= 2) {
      // Title is everything before the last 2 parts
      const title = parts.slice(0, -2).join(", ").trim();
      const appIdStr = parts[parts.length - 2];
      const explanation = parts[parts.length - 1];
      
      const appId = parseInt(appIdStr, 10);
      if (!isNaN(appId) && appId > 0 && title) {
        items.push({
          title,
          steamLink: `https://store.steampowered.com/app/${appId}/`,
          explanation: explanation || "",
          appId,
        });
      }
    }
  }

  return items;
}

export async function SuggestionsList({ appid }: SuggestionsListProps) {
  // Fetch suggestions from database
  const { data: suggestionData } = await supabase
    .from("suggestions")
    .select("result_text")
    .eq("steam_appid", appid)
    .maybeSingle();

  let suggestionsText = suggestionData?.result_text || null;

  // If no suggestions exist, generate them automatically
  if (!suggestionsText) {
    try {
      // Fetch game data to generate suggestions
      const { data: gameData } = await supabase
        .from("games_new")
        .select("screenshots, title, short_description, long_description")
        .eq("appid", appid)
        .single();

      if (gameData && gameData.screenshots && gameData.screenshots.length > 0) {
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

        // Save to DB
        await supabase.from("suggestions").upsert(
          {
            steam_appid: appid,
            result_text: suggestions.result,
            usage_stats: suggestions.usage || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "steam_appid" }
        );

        suggestionsText = suggestions.result;
      }
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to generate suggestions:",
        error
      );
      // Continue and show empty state
    }
  }

  if (!suggestionsText) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No suggestions available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const suggestions = parseSuggestions(suggestionsText);

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No suggestions available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Fetch and save suggested games
  if (suggestions.length > 0) {
    try {
      await fetchAndSaveSuggestedGames(suggestions);
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to fetch suggested games:",
        error
      );
      // Continue even if fetching fails - we'll just show suggestions without GameCards
    }
  }

  // Extract app IDs from suggestions (including ones that might have been found by title)
  const appIds = suggestions
    .map((s) => s.appId)
    .filter((id): id is number => id !== undefined);

  // Fetch game data from database
  let games: GameNew[] = [];
  if (appIds.length > 0) {
    const { data: gamesData } = await supabase
      .from("games_new")
      .select("*")
      .in("appid", appIds);

    games = (gamesData || []) as GameNew[];
  }

  // Also try to find games by title for suggestions without app IDs
  const suggestionsWithoutAppIds = suggestions.filter((s) => !s.appId && s.title);
  if (suggestionsWithoutAppIds.length > 0) {
    const titleSearchPromises = suggestionsWithoutAppIds.map(async (suggestion) => {
      const { data } = await supabase
        .from("games_new")
        .select("*")
        .ilike("title", `%${suggestion.title}%`)
        .limit(1)
        .maybeSingle();

      return data;
    });

    const titleMatches = (await Promise.all(titleSearchPromises)).filter(
      (game): game is GameNew => game !== null
    );
    games = [...games, ...titleMatches];
  }

  // Create a map of games by appid for quick lookup
  const gamesMap = new Map<number, GameNew>();
  // Also create a map by title (case-insensitive) for fallback matching
  const gamesByTitleMap = new Map<string, GameNew>();
  for (const game of games) {
    gamesMap.set(game.appid, game);
    if (game.title) {
      gamesByTitleMap.set(game.title.toLowerCase(), game);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {suggestions.map((item, index) => {
        // Try to find game by app ID first, then by title
        let gameData = item.appId ? gamesMap.get(item.appId) : null;
        if (!gameData && item.title) {
          gameData = gamesByTitleMap.get(item.title.toLowerCase()) || null;
        }

        return (
          <div key={index} className="flex flex-col">
            {gameData ? (
              <GameCard {...gameData} />
            ) : (
              <div>{item.title || `Loading game ${item.appId}...`}</div>
            )}
            {item.explanation && (
              <p className="text-xs text-muted-foreground mt-2">
                {item.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
