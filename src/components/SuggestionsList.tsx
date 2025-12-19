import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { supabase } from "@/lib/supabase/server";
import { GameNew, Suggestion } from "@/lib/supabase/types";
import { autoIngestMissingGames, refreshSuggestions } from "@/lib/ingest";

interface SuggestionsListProps {
  appid: number;
}

/**
 * Wait for a game to exist in the database (handles race condition with background ingest)
 */
async function waitForGameInDb(
  appid: number,
  maxAttempts = 15,
  delayMs = 1000
): Promise<{ title: string | null; suggested_game_appids: Suggestion[] | null } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: gameData } = await supabase
      .from("games_new")
      .select("title, suggested_game_appids")
      .eq("appid", appid)
      .maybeSingle();

    if (gameData) {
      return gameData;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

export async function SuggestionsList({ appid }: SuggestionsListProps) {
  // Fetch suggestions from cache, waiting for game to exist if needed
  // (handles race condition where ingest is still running in background)
  let gameData = await supabase
    .from("games_new")
    .select("title, suggested_game_appids")
    .eq("appid", appid)
    .maybeSingle()
    .then((r) => r.data);

  // If game not in DB yet, wait for background ingest to complete
  if (!gameData) {
    console.log(`[SUGGESTIONS LIST] Game ${appid} not in DB, waiting for ingest...`);
    gameData = await waitForGameInDb(appid);
    
    if (!gameData) {
      console.error(`[SUGGESTIONS LIST] Game ${appid} still not in DB after waiting`);
      return (
        <Card>
          <CardHeader>
            <CardTitle>Similar Games</CardTitle>
            <CardDescription>
              Game is still being processed. Please refresh the page in a moment.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
  }

  let suggestions: Suggestion[] = gameData?.suggested_game_appids || [];
  const gameTitle = gameData?.title || "";

  // No suggestions? Generate them now (Suspense streams this in)
  if (!suggestions || suggestions.length === 0) {
    try {
      const result = await refreshSuggestions(appid);
      suggestions = result.suggestions;
    } catch (err) {
      console.error("[SUGGESTIONS LIST] Failed to generate suggestions:", err);
      return (
        <Card>
          <CardHeader>
            <CardTitle>Similar Games</CardTitle>
            <CardDescription>
              Couldn&apos;t generate suggestions. Try the &quot;Load more&quot; button.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
  }

  // Extract app IDs for fetching
  const suggestedAppIds = suggestions.map((s) => s.appId);

  // Ingest any missing games first (Suspense keeps skeleton up while this runs)
  await autoIngestMissingGames(suggestedAppIds);

  // Now fetch all games from DB (including newly ingested ones)
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

  // Filter out DLCs
  const cachedGames = ((games || []) as GameNew[]).filter((g) => {
    const rawType = (g.raw as { type?: string })?.type;
    return rawType === "game" || !rawType;
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
        <div className="grid md:grid-cols-3 gap-6">
          {sortedGames.map((game) => (
            <GameCard key={game.appid} {...game} />
          ))}
        </div>
      </div>
    </>
  );
}
