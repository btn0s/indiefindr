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
import { suggestGames } from "@/lib/suggest";
import { fetchSteamGame, type SteamGameData } from "@/lib/steam";

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
      // Extract app IDs
      const appIds = suggestions
        .map((s) => s.appId)
        .filter((id): id is number => id !== undefined);

      // Check which games already exist in the database
      const { data: existingGames } = await supabase
        .from("games_new")
        .select("appid")
        .in("appid", appIds);

      const existingAppIds = new Set((existingGames || []).map((g) => g.appid));

      // Fetch and save each game that doesn't exist yet
      const promises = suggestions.map(async (suggestion) => {
        // Skip if we already have this game
        if (suggestion.appId && existingAppIds.has(suggestion.appId)) {
          return;
        }

        let appIdToFetch = suggestion.appId;

        // If no app ID, try searching by title
        if (!appIdToFetch && suggestion.title) {
          const { data } = await supabase
            .from("games_new")
            .select("appid")
            .ilike("title", `%${suggestion.title}%`)
            .limit(1)
            .maybeSingle();

          if (data?.appid) {
            appIdToFetch = data.appid;
            console.log(
              `[SUGGESTIONS LIST] Found game by title "${suggestion.title}": ${appIdToFetch}`
            );
          }
        }

        if (!appIdToFetch) {
          console.warn(
            `[SUGGESTIONS LIST] No valid app ID for suggestion: ${suggestion.title}`
          );
          return;
        }

        try {
          const steamData = await fetchSteamGame(appIdToFetch.toString());
          await supabase.from("games_new").upsert(
            {
              appid: steamData.appid,
              screenshots: steamData.screenshots,
              videos: steamData.videos,
              title: steamData.title,
              header_image: steamData.header_image,
              short_description: steamData.short_description,
              long_description: steamData.long_description,
              raw: steamData.raw,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "appid" }
          );
          console.log(
            `[SUGGESTIONS LIST] Saved game ${appIdToFetch}: ${steamData.title}`
          );
        } catch (error) {
          // If app ID fetch failed and we have a title, try searching by title
          if (suggestion.title) {
            console.log(
              `[SUGGESTIONS LIST] App ID ${appIdToFetch} failed, trying title search for "${suggestion.title}"`
            );

            // First, try searching our database
            const { data: dbData } = await supabase
              .from("games_new")
              .select("appid")
              .ilike("title", `%${suggestion.title}%`)
              .limit(1)
              .maybeSingle();

            let foundAppId = dbData?.appid;

            // If not found in database, try Steam search API
            if (!foundAppId) {
              try {
                const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(suggestion.title)}&cc=US&l=en`;
                const searchResponse = await fetch(searchUrl);
                if (searchResponse.ok) {
                  const searchData = await searchResponse.json();
                  if (searchData.items && searchData.items.length > 0) {
                    // Get the first result's app ID
                    foundAppId = searchData.items[0].id;
                    console.log(
                      `[SUGGESTIONS LIST] Found app ID ${foundAppId} via Steam search for "${suggestion.title}"`
                    );
                  }
                }
              } catch (searchError) {
                console.warn(
                  `[SUGGESTIONS LIST] Steam search failed for "${suggestion.title}":`,
                  searchError
                );
              }
            } else {
              console.log(
                `[SUGGESTIONS LIST] Found app ID ${foundAppId} in database for "${suggestion.title}"`
              );
            }

            // If we found a different app ID, try fetching it
            if (foundAppId && foundAppId !== appIdToFetch) {
              try {
                const steamData = await fetchSteamGame(foundAppId.toString());
                await supabase.from("games_new").upsert(
                  {
                    appid: steamData.appid,
                    screenshots: steamData.screenshots,
                    videos: steamData.videos,
                    title: steamData.title,
                    header_image: steamData.header_image,
                    short_description: steamData.short_description,
                    long_description: steamData.long_description,
                    raw: steamData.raw,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "appid" }
                );
                console.log(
                  `[SUGGESTIONS LIST] Fallback: Found and saved "${suggestion.title}" with app ID ${foundAppId}`
                );
                return;
              } catch (fallbackError) {
                console.error(
                  `[SUGGESTIONS LIST] Fallback fetch also failed for "${suggestion.title}":`,
                  fallbackError
                );
              }
            }
          }
          console.error(
            `[SUGGESTIONS LIST] Failed to fetch/save game ${appIdToFetch} (${suggestion.title}):`,
            error
          );
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to fetch suggested games:",
        error
      );
      // Continue even if fetching fails - we'll just show suggestions without GameCards
    }
  }

  // Extract app IDs from suggestions
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
