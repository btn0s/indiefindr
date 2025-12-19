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

    // Look for Steam Link and Why it's similar
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Check for Steam Link
      if (line.match(/steam\s+link/i) || line.match(/steam.*url/i)) {
        const linkMatch = line.match(/https?:\/\/[^\s\)]+/);
        if (linkMatch) {
          steamLink = linkMatch[0].replace(/[\.\)]+$/, ""); // Remove trailing punctuation
        }
      }
      // Check for explanation/similarity reason
      else if (line.match(/why.*similar/i) || line.match(/similar.*because/i)) {
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

  const suggestionsText = suggestionData?.result_text || null;

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
    <div className="flex flex-col gap-2">
      {suggestions.map((item, index) => {
        const gameData = item.appId ? gamesMap.get(item.appId) : null;

        return (
          <div key={index} className="border-b last:border-b-0 pb-6 last:pb-0">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Game Card */}
              {gameData ? (
                <div className="w-full md:w-48 shrink-0">
                  <GameCard {...gameData} />
                </div>
              ) : null}

              {/* Text Content */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  {item.steamLink && !gameData && (
                    <Link
                      href={item.steamLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Badge variant="outline">View on Steam</Badge>
                    </Link>
                  )}
                </div>
                {item.explanation && (
                  <p className="text-muted-foreground text-sm">
                    {item.explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
