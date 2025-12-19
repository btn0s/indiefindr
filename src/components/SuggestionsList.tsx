import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew, ParsedSuggestionItem } from "@/lib/supabase/types";
import { suggestGames } from "@/lib/suggest";
import { fetchSteamGame } from "@/lib/steam";

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
  const { data: gameData } = await supabase
    .from("games_new")
    .select("suggestions_result_text, screenshots, title, short_description, long_description")
    .eq("appid", appid)
    .maybeSingle();

  let suggestionsText = gameData?.suggestions_result_text || null;

  // If no suggestions exist, generate them automatically
  if (!suggestionsText && gameData) {
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

        // Save to DB
        await supabase
          .from("games_new")
          .update({
            suggestions_result_text: suggestions.result,
            suggestions_usage_stats: suggestions.usage || null,
            updated_at: new Date().toISOString(),
          })
          .eq("appid", appid);

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
      // Returns corrections: { oldAppId: newAppId } or null
      const promises = suggestions.map(async (suggestion): Promise<{ oldAppId: number; newAppId: number } | null> => {
        // Skip if we already have this game
        if (suggestion.appId && existingAppIds.has(suggestion.appId)) {
          return null;
        }

        let appIdToFetch = suggestion.appId;
        let correction: { oldAppId: number; newAppId: number } | null = null;
        const originalAppId = suggestion.appId;

        // If no app ID, try searching by title
        if (!appIdToFetch && suggestion.title) {
          const { data } = await supabase
            .from("games_new")
            .select("appid")
            .ilike("title", `%${suggestion.title}%`)
            .limit(1)
            .maybeSingle();

          if (data?.appid) {
            const newAppId = data.appid;
            appIdToFetch = newAppId;
            // Track correction if we had an original app ID
            if (typeof originalAppId === 'number' && originalAppId !== newAppId) {
              correction = { oldAppId: originalAppId, newAppId };
            }
            console.log(
              `[SUGGESTIONS LIST] Found game by title "${suggestion.title}": ${appIdToFetch}`
            );
          }
        }

        if (!appIdToFetch) {
          console.warn(
            `[SUGGESTIONS LIST] No valid app ID for suggestion: ${suggestion.title}`
          );
          return null;
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
          return correction;
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
            if (foundAppId && appIdToFetch && foundAppId !== appIdToFetch) {
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
                // Return the correction - we know appIdToFetch is a number here
                correction = { oldAppId: appIdToFetch, newAppId: foundAppId };
                console.log(
                  `[SUGGESTIONS LIST] Fallback: Found and saved "${suggestion.title}" with app ID ${foundAppId}`
                );
                return correction;
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
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      // Collect all corrections
      const appIdCorrections = new Map<number, number>();
      for (const result of results) {
        if (result) {
          appIdCorrections.set(result.oldAppId, result.newAppId);
        }
      }

      // If we found any app ID corrections, update the suggestions text and save it
      if (appIdCorrections.size > 0) {
        let updatedSuggestionsText = suggestionsText;
        
        // Replace old app IDs with new ones in the suggestions text
        for (const [oldAppId, newAppId] of appIdCorrections.entries()) {
          // Replace the old app ID with the new one in the text
          // Match pattern: title, oldAppId, explanation -> title, newAppId, explanation
          // Preserve whitespace around the app ID
          const regex = new RegExp(`(,\\s*)${oldAppId}(\\s*,)`, 'g');
          updatedSuggestionsText = updatedSuggestionsText.replace(regex, `$1${newAppId}$2`);
        }

        // Update suggestions array with corrected app IDs
        for (const suggestion of suggestions) {
          if (suggestion.appId && appIdCorrections.has(suggestion.appId)) {
            const newAppId = appIdCorrections.get(suggestion.appId)!;
            suggestion.appId = newAppId;
            suggestion.steamLink = `https://store.steampowered.com/app/${newAppId}/`;
          }
        }

        // Save updated suggestions to database
        if (updatedSuggestionsText !== suggestionsText) {
          await supabase
            .from("games_new")
            .update({
              suggestions_result_text: updatedSuggestionsText,
              updated_at: new Date().toISOString(),
            })
            .eq("appid", appid);
          
          console.log(
            `[SUGGESTIONS LIST] Updated suggestions with ${appIdCorrections.size} corrected app IDs`
          );
          
          suggestionsText = updatedSuggestionsText;
        }
      }
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to fetch suggested games:",
        error
      );
      // Continue even if fetching fails - we'll just show suggestions without GameCards
    }
  }

  // Extract app IDs from suggestions (may have been corrected)
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

  // Create a map of games by appid for quick lookup
  const gamesMap = new Map<number, GameNew>();
  for (const game of games) {
    gamesMap.set(game.appid, game);
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {suggestions.map((item, index) => {
        // Find game by app ID
        const gameData = item.appId ? gamesMap.get(item.appId) : null;

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
