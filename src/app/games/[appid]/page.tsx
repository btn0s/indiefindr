import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsListClient } from "@/components/SuggestionsListClient";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { SteamButton } from "@/components/SteamButton";
import { supabase } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";

type GameData = {
  appid: number;
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  screenshots: string[];
  videos: string[];
};

/**
 * Wait for a game to exist in the database (handles race condition with background ingest)
 * Similar to SuggestionsList.waitForGameInDb but for full game data
 */
async function waitForGameInDb(
  appId: number,
  maxAttempts = 15, // Increased attempts for longer wait if needed
  delayMs = 1000   // 1s delay
): Promise<GameData | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: dbGame } = await supabase
      .from("games_new")
      .select(
        "appid, title, header_image, short_description, long_description, screenshots, videos"
      )
      .eq("appid", appId)
      .maybeSingle();

    if (dbGame && dbGame.title) {
      return {
        appid: dbGame.appid,
        title: dbGame.title,
        header_image: dbGame.header_image,
        short_description: dbGame.short_description,
        long_description: dbGame.long_description,
        screenshots: dbGame.screenshots || [],
        videos: dbGame.videos || [],
      };
    }

    // Wait before retrying - this blocks the server component, keeping the Suspense fallback active
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

/**
 * Fetch game data from database only (never calls Steam API).
 * Uses cache() to dedupe requests within the same render.
 */
const getGameDataFromDb = cache(async (appId: number): Promise<GameData | null> => {
  const { data: dbGame } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, short_description, long_description, screenshots, videos"
    )
    .eq("appid", appId)
    .maybeSingle();

  if (dbGame && dbGame.title) {
    return {
      appid: dbGame.appid,
      title: dbGame.title,
      header_image: dbGame.header_image,
      short_description: dbGame.short_description,
      long_description: dbGame.long_description,
      screenshots: dbGame.screenshots || [],
      videos: dbGame.videos || [],
    };
  }

  // Game not in DB yet - wait for background ingest
  // This will block the server response and let Next.js stream the UI once it resolves
  return waitForGameInDb(appId);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ appid: string }>;
}): Promise<Metadata> {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return {
      title: "Game Not Found",
    };
  }

  // Use cached DB fetch (deduped with page component)
  // We don't want metadata to wait 15s though, so maybe a shorter check here?
  // But for now let's keep it consistent.
  const gameData = await getGameDataFromDb(appId);

  if (!gameData || !gameData.title) {
    return {
      title: "Game Not Found",
      description: "Discover similar indie games with matching gameplay, style, and themes.",
    };
  }

  const cleanDescription = `Looking for games like ${gameData.title}? Discover similar indie games with matching gameplay, style, and themes.`;
  const title = `Games like ${gameData.title}`;
  const url = `/games/${appid}`;

  return {
    title,
    description: cleanDescription,
    openGraph: {
      title,
      description: cleanDescription,
      url,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
      images: gameData.header_image ? [gameData.header_image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: gameData.header_image ? [gameData.header_image] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}

// Server component for game content
async function GameContent({ appId, appid }: { appId: number; appid: string }) {
  const gameData = await getGameDataFromDb(appId);

  if (!gameData || !gameData.title) {
    // If it still hasn't loaded after waiting, show not found or fallback
    notFound();
  }

  const description = gameData.short_description || null;

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: gameData.title,
    description: description
      ? description.replace(/<[^>]*>/g, "").substring(0, 500)
      : undefined,
    image: gameData.header_image || undefined,
    url: `https://store.steampowered.com/app/${appid}/`,
    gamePlatform: "Steam",
    applicationCategory: "Game",
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <h1
        className="text-xl sm:text-2xl font-semibold leading-snug text-balance line-clamp-2"
        title={`Games like ${gameData.title}`}
      >
        Games like {gameData.title}
      </h1>

      {/* Trailer Video - Full Width */}
      {gameData.videos && gameData.videos.length > 0 && (
        <div className="w-full aspect-video">
          <GameVideo
            videos={gameData.videos}
            headerImage={gameData.header_image}
            alt={gameData.title}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Game Header */}
      <div className="flex gap-3 sm:gap-4 items-center">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-sm sm:text-lg font-semibold truncate sm:whitespace-normal">
            {gameData.title}
          </div>

          {description && (
            <p className="text-muted-foreground line-clamp-4 text-sm mb-2">
              {description.replace(/<[^>]*>/g, "").substring(0, 200)}
              {description.length > 300 ? "..." : ""}
            </p>
          )}

          <SteamButton appid={appid} title={gameData.title} />
        </div>
      </div>

      {/* Suggestions Section - Nested Suspense */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <h2
            className="flex-1 min-w-0 text-base sm:text-lg font-semibold leading-snug text-balance line-clamp-2"
            title={`Games similar to ${gameData.title}`}
          >
            Games similar to {gameData.title}
          </h2>
        </div>
        <SuggestionsListClient appid={appId} />
      </div>
    </>
  );
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 flex flex-col gap-3 sm:gap-4">
        <Suspense
          fallback={
            <>
              {/* Main content skeleton */}
              <Skeleton className="h-8 w-64" />
              <Skeleton className="w-full aspect-video" />
              <div className="flex gap-3 sm:gap-4 items-center mb-4">
                <div className="flex-1 flex flex-col min-w-0 gap-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-32 mt-2" />
                </div>
              </div>
              {/* Suggestions section skeleton */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <Skeleton className="h-6 w-64 max-w-full" />
                </div>
                <SuggestionsSkeleton showNotice={false} />
              </div>
            </>
          }
        >
          <GameContent appId={appId} appid={appid} />
        </Suspense>
      </main>
    </div>
  );
}

// Enable ISR - revalidate every 60 seconds
export const revalidate = 60;
