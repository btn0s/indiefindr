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
    .select("title, suggested_game_appids")
    .eq("appid", appid)
    .maybeSingle();

  const suggestions: Suggestion[] = gameData?.suggested_game_appids || [];
  const gameTitle = gameData?.title || "";

  // No suggestions? Show empty state with prompt to load
  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>
            Click &quot;Load more&quot; to discover similar games.
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
            {suggestions.length} games found, loading details... Click
            &quot;Load more&quot; to refresh.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasMoreToLoad =
    sortedGames.length < suggestions.length ||
    suggestions.length < MIN_SUGGESTIONS;

  // Generate structured data for SEO
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Games similar to ${gameTitle}`,
    itemListElement: sortedGames.map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "VideoGame",
        name: game.title,
        url: `https://indiefindr.gg/games/${game.appid}`,
      },
    })),
  };

  const topTitles = sortedGames
    .slice(0, 3)
    .map((g) => g.title)
    .join(", ");
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What games are similar to ${gameTitle}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Games like ${gameTitle} include ${
            topTitles || "various indie games"
          }. These games share similar gameplay mechanics and visual style.`,
        },
      },
    ],
  };

  // Render cached games in suggested order with explanations
  return (
    <>
      {sortedGames.length > 0 && (
        <>
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(itemListSchema),
            }}
          />
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          />
        </>
      )}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-6">
          {sortedGames.map((game) => (
            <GameCard key={game.appid} {...game} />
          ))}
        </div>
      </div>
    </>
  );
}
