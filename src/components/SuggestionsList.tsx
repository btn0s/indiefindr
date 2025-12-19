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
 * Extract app ID from Steam URL
 */
function extractAppIdFromUrl(url: string): number | null {
  if (!url) return null;
  const match = url.match(/\/app\/(\d+)/);
  if (match && match[1]) {
    const appId = parseInt(match[1], 10);
    if (!isNaN(appId) && appId > 0) {
      return appId;
    }
  }
  return null;
}

/**
 * Parse the suggestions text from Perplexity into structured data
 */
function parseSuggestions(text: string): ParsedSuggestionItem[] {
  const items: ParsedSuggestionItem[] = [];

  // Split by double newlines or patterns that indicate a new game entry
  // Also handle cases where entries are separated by numbered lists or ** markers
  const sections = text
    .split(/\n(?=\*\*[^*])|\n(?=\d+\.\s*\*\*)/)
    .filter((s) => s.trim());

  for (const section of sections) {
    const lines = section
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) continue;

    // First line should be the game title (may have **bold** markers, numbers, etc.)
    let titleLine = lines[0];
    // Remove markdown bold markers
    titleLine = titleLine.replace(/\*\*/g, "");
    // Remove numbered list prefixes
    titleLine = titleLine.replace(/^\d+\.\s*/, "");
    const title = titleLine.trim();

    // Skip if title is too long or looks like a heading
    if (
      !title ||
      title.length > 200 ||
      title.toLowerCase().includes("similar games")
    )
      continue;

    let steamLink = "";
    let explanation = "";
    let explanationStarted = false;

    // First, search the entire section for Steam URLs (they might be anywhere)
    const fullSection = section.trim();
    const steamUrlMatch = fullSection.match(
      /https?:\/\/store\.steampowered\.com\/app\/\d+(?:\/[^\s\)\n]*)?/
    );
    if (steamUrlMatch) {
      steamLink = steamUrlMatch[0].replace(/[\.\)]+$/, ""); // Remove trailing punctuation
    }

    // Look for Steam Link and Why it's similar
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Check for Steam Link (look for Steam store URLs anywhere in the line)
      if (!steamLink) {
        const lineSteamUrlMatch = line.match(
          /https?:\/\/store\.steampowered\.com\/app\/\d+(?:\/[^\s\)]*)?/
        );
        if (lineSteamUrlMatch) {
          steamLink = lineSteamUrlMatch[0].replace(/[\.\)]+$/, ""); // Remove trailing punctuation
        }
      }
      // Also check for lines explicitly mentioning Steam Link/URL
      if (
        !steamLink &&
        (line.match(/steam\s+link/i) || line.match(/steam.*url/i))
      ) {
        const linkMatch = line.match(/https?:\/\/[^\s\)]+/);
        if (linkMatch) {
          steamLink = linkMatch[0].replace(/[\.\)]+$/, ""); // Remove trailing punctuation
        }
      }
      // Check for explanation/similarity reason
      if (line.match(/why.*similar/i) || line.match(/similar.*because/i)) {
        explanationStarted = true;
        explanation = line
          .replace(/^\*\*Why\s+it'?s?\s+similar:?\*\*\s*-?\s*/i, "")
          .replace(/^\*\*Similar.*:?\*\*\s*-?\s*/i, "")
          .replace(/\*\*/g, "")
          .trim();
      }
      // If explanation has started, continue collecting it (might span multiple lines)
      else if (
        explanationStarted &&
        line &&
        !line.match(/steam/i) &&
        !line.match(/https?:/)
      ) {
        explanation +=
          (explanation ? " " : "") + line.replace(/\*\*/g, "").trim();
      }
    }

    // Extract app ID from Steam link
    const appId = steamLink ? extractAppIdFromUrl(steamLink) : null;

    // If we have a title, add it (even if we couldn't parse link/explanation)
    if (title) {
      items.push({
        title,
        steamLink: steamLink || "",
        explanation: explanation.trim(),
        appId: appId || undefined,
      });
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

  // Extract Steam links and app IDs from suggestions
  const steamLinks = suggestions
    .map((s) => s.steamLink)
    .filter((link): link is string => Boolean(link));
  const appIds = extractAppIdsFromSuggestions(steamLinks);

  // Fetch and save Steam data for suggested games (if not already in DB)
  if (appIds.length > 0) {
    try {
      await fetchAndSaveSuggestedGames(appIds);
    } catch (error) {
      console.error(
        "[SUGGESTIONS LIST] Failed to fetch suggested games:",
        error
      );
      // Continue even if fetching fails - we'll just show suggestions without GameCards
    }
  }

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
        const gameData = item.appId ? gamesMap.get(item.appId) : null;

        return (
          <div key={index} className="flex flex-col">
            {gameData ? <GameCard {...gameData} /> : <div>{item.title}</div>}
            {item.explanation && <p className="text-xs">{item.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}
