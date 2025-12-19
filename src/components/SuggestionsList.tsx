import { Suspense } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameCard from "@/components/GameCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase/server";
import { GameNew } from "@/lib/supabase/types";
import { suggestGames } from "@/lib/suggest";
import { fetchSteamGame } from "@/lib/steam";

interface SuggestionsListProps {
  appid: number;
}

// Skeleton for a single game card
function GameCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="w-full aspect-video mb-2 rounded-md" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

// Async component that fetches a single missing game
async function StreamingGameCard({ appId }: { appId: number }) {
  try {
    const steamData = await fetchSteamGame(appId.toString());

    // Skip DLCs, demos, mods, etc.
    if (steamData.type !== "game") {
      console.log(`[STREAMING] Skipping ${appId} (type: ${steamData.type})`);
      return null;
    }

    // Save to DB in background
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

    return <GameCard {...(steamData as unknown as GameNew)} />;
  } catch (err) {
    console.error(`[STREAMING] Failed to fetch game ${appId}:`, err);
    return null;
  }
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
  const cachedAppIds = new Set(cachedGames.map((g) => g.appid));

  type RenderItem =
    | { type: "cached"; game: GameNew }
    | { type: "missing"; appId: number };

  // Build render order matching suggested order
  const renderItems: RenderItem[] = suggestedAppIds.map((appId: number) => {
    const cached = cachedGames.find((g) => g.appid === appId);
    if (cached) {
      return { type: "cached" as const, game: cached };
    }
    return { type: "missing" as const, appId };
  });

  if (renderItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>No games found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Render: cached games immediately, missing games stream in with Suspense
  return (
    <div className="grid grid-cols-3 gap-6">
      {renderItems.map((item) =>
        item.type === "cached" ? (
          <GameCard key={item.game.appid} {...item.game} />
        ) : (
          <Suspense key={item.appId} fallback={<GameCardSkeleton />}>
            <StreamingGameCard appId={item.appId} />
          </Suspense>
        )
      )}
    </div>
  );
}
