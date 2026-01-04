import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsListClient } from "@/components/SuggestionsListClient";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { SteamButton } from "@/components/SteamButton";
import { DevControlBar } from "@/components/DevControlBar";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameDetailSkeleton } from "@/components/skeletons/GameDetailSkeleton";
import { getPinnedCollectionsForGame } from "@/lib/collections";
import { CollectionsSection } from "@/components/CollectionsSection";
import { GameProcessingState } from "@/components/GameProcessingState";

type GameData = {
  appid: number;
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  screenshots: string[];
  videos: string[];
  release_date: string | null;
  developers: string[];
  publishers: string[];
  genres: Array<{ id: number; description: string }>;
  price: string | null;
  platforms: { windows?: boolean; mac?: boolean; linux?: boolean } | null;
  metacritic_score: number | null;
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
        "appid, title, header_image, short_description, long_description, screenshots, videos, raw"
      )
      .eq("appid", appId)
      .maybeSingle();

    if (dbGame && dbGame.title) {
      const metadata = extractMetadata(dbGame.raw);
      return {
        appid: dbGame.appid,
        title: dbGame.title,
        header_image: dbGame.header_image,
        short_description: dbGame.short_description,
        long_description: dbGame.long_description,
        screenshots: dbGame.screenshots || [],
        videos: dbGame.videos || [],
        ...metadata,
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
        "appid, title, header_image, short_description, long_description, screenshots, videos, raw"
      )
      .eq("appid", appId)
      .maybeSingle();

    if (dbGame && dbGame.title) {
      const metadata = extractMetadata(dbGame.raw);
      return {
        appid: dbGame.appid,
        title: dbGame.title,
        header_image: dbGame.header_image,
        short_description: dbGame.short_description,
        long_description: dbGame.long_description,
        screenshots: dbGame.screenshots || [],
        videos: dbGame.videos || [],
        ...metadata,
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
 * Extract metadata from Steam raw JSONB data
 */
function extractMetadata(raw: unknown): {
  release_date: string | null;
  developers: string[];
  publishers: string[];
  genres: Array<{ id: number; description: string }>;
  price: string | null;
  platforms: { windows?: boolean; mac?: boolean; linux?: boolean } | null;
  metacritic_score: number | null;
} {
  if (!raw || typeof raw !== "object") {
    return {
      release_date: null,
      developers: [],
      publishers: [],
      genres: [],
      price: null,
      platforms: null,
      metacritic_score: null,
    };
  }

  const data = raw as Record<string, unknown>;

  // Extract release date
  const releaseDate =
    data.release_date && typeof data.release_date === "object"
      ? (data.release_date as { date?: string }).date || null
      : null;

  // Extract developers
  const developers =
    Array.isArray(data.developers)
      ? (data.developers as string[]).filter((d) => typeof d === "string")
      : [];

  // Extract publishers
  const publishers =
    Array.isArray(data.publishers)
      ? (data.publishers as string[]).filter((p) => typeof p === "string")
      : [];

  // Extract genres
  const genres =
    Array.isArray(data.genres)
      ? (data.genres as Array<{ id?: number; description?: string }>)
          .filter((g) => g.id && g.description)
          .map((g) => ({ id: g.id!, description: g.description! }))
      : [];

  // Extract price
  let price: string | null = null;
  if (
    data.price_overview &&
    typeof data.price_overview === "object" &&
    data.price_overview !== null
  ) {
    const priceOverview = data.price_overview as {
      final_formatted?: string;
      final?: number;
      currency?: string;
    };
    price = priceOverview.final_formatted || null;
    if (!price && priceOverview.final !== undefined && priceOverview.currency) {
      // Format price manually if needed
      const amount = (priceOverview.final / 100).toFixed(2);
      price = `${priceOverview.currency}${amount}`;
    }
  }

  // Extract platforms
  let platforms: { windows?: boolean; mac?: boolean; linux?: boolean } | null =
    null;
  if (data.platforms && typeof data.platforms === "object") {
    const platformData = data.platforms as Record<string, unknown>;
    platforms = {
      windows: Boolean(platformData.windows),
      mac: Boolean(platformData.mac),
      linux: Boolean(platformData.linux),
    };
  }

  // Extract Metacritic score
  const metacritic_score =
    data.metacritic && typeof data.metacritic === "object" && data.metacritic !== null
      ? (data.metacritic as { score?: number }).score || null
      : null;

  return {
    release_date: releaseDate,
    developers,
    publishers,
    genres,
    price,
    platforms,
    metacritic_score,
  };
}

/**
 * Fast DB fetch for metadata generation (never waits for background ingest).
 */
async function getGameDataFromDbFast(appId: number): Promise<GameData | null> {
  const supabase = getSupabaseServerClient();
  const { data: dbGame } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, short_description, long_description, screenshots, videos, raw"
    )
    .eq("appid", appId)
    .maybeSingle();

  if (!dbGame || !dbGame.title) return null;

  const metadata = extractMetadata(dbGame.raw);
  return {
    appid: dbGame.appid,
    title: dbGame.title,
    header_image: dbGame.header_image,
    short_description: dbGame.short_description,
    long_description: dbGame.long_description,
    screenshots: dbGame.screenshots || [],
    videos: dbGame.videos || [],
    ...metadata,
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
    // If it still hasn't loaded after waiting, show processing state instead of 404
    // This handles slow ingestion (rate limiting, network delays) gracefully
    return <GameProcessingState appid={appid} />;
  }

  const description = gameData.short_description || null;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/games/${appid}`;
  const steamUrl = `https://store.steampowered.com/app/${appid}/`;

  // Fetch pinned collections for this game
  const pinnedCollections = await getPinnedCollectionsForGame(appId);

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
      <div className="flex flex-col gap-4">
        {/* Title and Description */}
        <div className="flex flex-col gap-1.5">
          <div className="text-base sm:text-lg font-semibold leading-tight">
            {gameData.title}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {truncate(stripHtml(description), 220)}
            </p>
          )}
        </div>

        {/* Inline Metadata - Release, Developers */}
        {(gameData.release_date || gameData.developers.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
            {gameData.release_date && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Release:</span>
                <span className="text-foreground">{gameData.release_date}</span>
              </div>
            )}
            {gameData.developers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Developer{gameData.developers.length > 1 ? "s" : ""}:</span>
                <span className="text-foreground">{gameData.developers.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* Steam Button */}
        <div className="pt-1">
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

      {/* Pinned Collections Section */}
      {pinnedCollections.length > 0 && (
        <div className="flex flex-col gap-3">
          <CollectionsSection
            collections={pinnedCollections}
            title="Featured Collections"
          />
        </div>
      )}
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
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-3 sm:gap-4">
      <Suspense
        fallback={
          <GameDetailSkeleton />
        }
      >
        <GameContent appId={appId} appid={appid} />
      </Suspense>
      <DevControlBar appid={appId} />
    </main>
  );
}

// Enable ISR - revalidate every 60 seconds
export const revalidate = 60;
