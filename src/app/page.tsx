import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GamesGrid } from "@/components/GamesGrid";
import { GameNew } from "@/lib/supabase/types";
import { isLikelyIndie, isRecent } from "@/lib/utils/indie-detection";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/`;
  const title = "Find Your Next Favorite Indie Game — IndieFindr";
  const description =
    "Discover indie games on Steam. Search any game, get AI-powered recommendations, and find your next favorite.";
  const ogImageUrl = `${siteUrl}/og/home.png`;

  return {
    title,
    description,
    keywords: [
      "games like",
      "find games like",
      "similar games",
      "game recommendations",
      "indie game recommendations",
      "steam game recommendations",
      "discover indie games",
      "IndieFindr",
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "IndieFindr game discovery",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

async function getGames(): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();
  // Fetch more games than needed to ensure we can filter for indie games
  // This helps ensure indie games appear at the top even if AAA games are in the first rows
  const FETCH_SIZE = PAGE_SIZE * 3; // Fetch 3x to have enough indie games to choose from
  const { data: games, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
    )
    .range(0, FETCH_SIZE - 1);

  if (error) {
    console.error("Error loading games:", error);
    return [];
  }

  // Sort to prioritize indie games:
  // 1. Recent indie games (last 6 months) - highest priority
  // 2. Other indie games
  // 3. Non-indie games - lowest priority
  // Within each group, sort by number of suggestions, then by created_at
  const sorted = (games || []).sort((a, b) => {
    const indieA = isLikelyIndie(a);
    const indieB = isLikelyIndie(b);
    const recentA = isRecent(a, 6);
    const recentB = isRecent(b, 6);

    // Priority 1: Recent indie games
    if (recentA && indieA && !(recentB && indieB)) return -1;
    if (recentB && indieB && !(recentA && indieA)) return 1;

    // Priority 2: Other indie games
    if (indieA && !indieB) return -1;
    if (indieB && !indieA) return 1;

    // Within same priority group, sort by number of suggestions
    const aCount = Array.isArray(a.suggested_game_appids)
      ? a.suggested_game_appids.length
      : 0;
    const bCount = Array.isArray(b.suggested_game_appids)
      ? b.suggested_game_appids.length
      : 0;

    if (bCount !== aCount) {
      return bCount - aCount; // Most suggestions first
    }

    // Tiebreaker: most recently created first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Return only the top PAGE_SIZE games (prioritized indie games)
  return (sorted as GameNew[]).slice(0, PAGE_SIZE);
}

export default async function Home() {
  const games = await getGames();

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="w-full">
        <div className="container mx-auto max-w-4xl w-full">
          <h1 className="text-balance font-semibold tracking-tight text-3xl sm:text-4xl">
            Find your next favorite indie game
          </h1>
        </div>
      </div>

      {/* Full-width grid section */}
      <div className="flex flex-col gap-4 w-full pb-8">
        <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">All Games</h2>
        </div>
        <div className="container mx-auto max-w-4xl w-full">
          {games.length === 0 ? (
            <p className="text-muted-foreground">
              No games ingested yet. Search for a game above to add your first
              one.
            </p>
          ) : (
            <GamesGrid initialGames={games} />
          )}
        </div>
      </div>
    </main>
  );
}
