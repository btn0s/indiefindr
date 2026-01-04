import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsList } from "@/components/SuggestionsList";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { SteamButton } from "@/components/SteamButton";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
      "IndieFindr",
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
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <div className="border-b-2 border-[#333] mb-6 pb-2">
        <h1
          className="text-xl sm:text-2xl font-display font-bold uppercase tracking-widest text-[#00ffcc]"
          title={`Games like ${gameData.title}`}
        >
          Games like <span className="text-white">{gameData.title}</span>
        </h1>
      </div>

      {/* Trailer Video - Full Width with bezel */}
      {gameData.videos && gameData.videos.length > 0 && (
        <div className="w-full aspect-video border-2 border-[#333] bevel-down p-1 bg-black mb-6">
          <GameVideo
            videos={gameData.videos}
            headerImage={gameData.header_image}
            alt={gameData.title}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Game Header Box */}
      <div className="bg-[#111] border border-[#333] p-4 mb-8">
        <div className="flex gap-4 items-start">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="text-lg font-bold uppercase tracking-wide mb-2 text-[#00ffcc]">
              {gameData.title}
            </div>

            {description && (
              <p className="text-[#aaa] font-sans text-sm mb-4 leading-relaxed">
                {truncate(stripHtml(description), 220)}
              </p>
            )}

            <SteamButton appid={appid} title={gameData.title} />
          </div>
        </div>
      </div>

      {/* Suggestions Section - Nested Suspense */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-l-4 border-[#00ffcc] pl-4 bg-[#111] py-2">
          <h2
            className="text-lg font-bold uppercase tracking-wide text-white"
            title={`Games similar to ${gameData.title}`}
          >
            Recommended Titles
          </h2>
        </div>
        <Suspense fallback={<SuggestionsSkeleton showNotice={false} />}>
          <SuggestionsList appid={appId} />
        </Suspense>
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
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 flex flex-col">
      <Suspense
        fallback={
          <>
            {/* Main content skeleton */}
            <Skeleton className="h-8 w-64 mb-6" />
            <Skeleton className="w-full aspect-video mb-6" />
            <div className="bg-[#111] border border-[#333] p-4 mb-8">
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <Skeleton className="h-8 w-32" />
            </div>
            {/* Suggestions section skeleton */}
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <SuggestionsSkeleton showNotice={false} />
            </div>
          </>
        }
      >
        <GameContent appId={appId} appid={appid} />
      </Suspense>
    </main>
  );
}

// Enable ISR - revalidate every 60 seconds
export const revalidate = 60;
