import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsList } from "@/components/SuggestionsList";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { SteamButton } from "@/components/SteamButton";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  delayMs = 1000 // 1s delay
): Promise<GameData | null> {
  const supabase = getSupabaseServerClient();
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
const getGameDataFromDb = cache(
  async (appId: number): Promise<GameData | null> => {
    const supabase = getSupabaseServerClient();
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
  }
);

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

/**
 * Fast DB fetch for metadata generation (never waits for background ingest).
 */
async function getGameDataFromDbFast(appId: number): Promise<GameData | null> {
  const supabase = getSupabaseServerClient();
  const { data: dbGame } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, short_description, long_description, screenshots, videos"
    )
    .eq("appid", appId)
    .maybeSingle();

  if (!dbGame || !dbGame.title) return null;

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

  // Keep metadata fast: never block on background ingest retries.
  const gameData = await getGameDataFromDbFast(appId);

  if (!gameData || !gameData.title) {
    return {
      title: "Game Not Found",
      description:
        "Discover similar indie games with matching gameplay, style, and themes.",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const title = `Games like ${gameData.title} — IndieFindr`;
  const canonicalPath = `/games/${appid}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const shortDesc = gameData.short_description
    ? stripHtml(gameData.short_description)
    : "";
  const cleanDescription = truncate(
    shortDesc
      ? `Find games like ${gameData.title} on Steam. ${shortDesc}`
      : `Find games like ${gameData.title} on Steam — similar indie games with matching gameplay, style, and themes.`,
    160
  );

  return {
    title,
    description: cleanDescription,
    keywords: [
      gameData.title,
      `games like ${gameData.title}`,
      `games similar to ${gameData.title}`,
      `games like ${gameData.title} on Steam`,
      "similar games on Steam",
      "indie games",
      "game recommendations",
      "indie game recommendations",
      "discover indie games",
    ],
    openGraph: {
      title,
      description: cleanDescription,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${canonicalUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Games like ${gameData.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: [`${canonicalUrl}/twitter-image`],
    },
    alternates: {
      canonical: canonicalUrl,
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
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/games/${appid}`;
  const steamUrl = `https://store.steampowered.com/app/${appid}/`;

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: gameData.title,
    description: description
      ? truncate(stripHtml(description), 500)
      : undefined,
    image: gameData.header_image || undefined,
    url: canonicalUrl,
    sameAs: steamUrl,
    gamePlatform: "Steam",
    applicationCategory: "Game",
  };

  return (
    <div className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <h1 className="text-2xl sm:text-4xl font-black text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] tracking-tighter uppercase italic">
        Games like {gameData.title}
      </h1>

      {/* Main Game Container */}
      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 p-4">
          {/* Trailer Video - Full Width */}
          {gameData.videos && gameData.videos.length > 0 && (
            <div className="w-full aspect-video win95-inset overflow-hidden">
              <GameVideo
                videos={gameData.videos}
                headerImage={gameData.header_image}
                alt={gameData.title}
                className="w-full h-full"
              />
            </div>
          )}

          {/* Game Header */}
          <div className="flex gap-4 items-start bg-white/50 p-3 win95-inset">
            <div className="flex-1 flex flex-col min-w-0 gap-1">
              <div className="text-base sm:text-lg font-bold text-black">
                {gameData.title}
              </div>

              {description && (
                <p className="text-black line-clamp-4 text-xs sm:text-sm font-normal leading-relaxed">
                  {truncate(stripHtml(description), 300)}
                </p>
              )}

              <div className="pt-2">
                <SteamButton appid={appid} title={gameData.title} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Section - Separate Container */}
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center gap-2 w-full">
          <div className="h-[3px] flex-1 win95-inset opacity-50" />
          <h2 className="px-3 text-[10px] font-black uppercase tracking-[0.3em] text-white drop-shadow-[1px_1px_0_rgba(0,0,0,1)] shrink-0">
            Similar Discoveries
          </h2>
          <div className="h-[3px] flex-1 win95-inset opacity-50" />
        </div>
        <Suspense fallback={<SuggestionsSkeleton showNotice={false} />}>
          <SuggestionsList appid={appId} />
        </Suspense>
      </div>
    </div>
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
    <main className="flex flex-col gap-8 py-4 sm:py-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-8">
            {/* Main content skeleton */}
            <div className="h-10 w-3/4 bg-white/20 animate-pulse drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]" />
            <Card className="w-full">
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="w-full aspect-video win95-inset bg-black/5 animate-pulse" />
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-1/2 bg-black/5 animate-pulse" />
                  <div className="h-4 w-full bg-black/5 animate-pulse" />
                  <div className="h-4 w-2/3 bg-black/5 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>
        }
      >
        <GameContent appId={appId} appid={appid} />
      </Suspense>
    </main>
  );
}

// Enable ISR - revalidate every 60 seconds
export const revalidate = 60;
