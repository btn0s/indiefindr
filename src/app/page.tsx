import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GamesGrid } from "@/components/GamesGrid";
import { GameNew } from "@/lib/supabase/types";

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
  const { data: games, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
    )
    .range(0, PAGE_SIZE - 1);

  if (error) {
    console.error("Error loading games:", error);
    return [];
  }

  // Sort by number of suggestions (most first), then by created_at as tiebreaker
  const sorted = (games || []).sort((a, b) => {
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

  return sorted as GameNew[];
}

export default async function Home() {
  const games = await getGames();

  return (
    <main className="px-4 py-6 sm:py-8">
      <div className="container mx-auto max-w-6xl w-full flex flex-col gap-6">
        <section className="retro-window">
          <div className="retro-titlebar">
            <div className="retro-titlebar-title">IndieFindr</div>
            <div className="retro-titlebar-meta hidden sm:block">
              Search above to add games to the database
            </div>
          </div>
          <div className="retro-window-body">
            <h1 className="text-balance font-extrabold tracking-tight text-3xl sm:text-4xl">
              Find your next favorite indie game
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-prose">
              Search any Steam game, instantly jump to its page, and get
              AI-powered recommendations with explanations.
            </p>
          </div>
          <div className="retro-statusbar">
            <span>Ready</span>
            <span className="opacity-80">1024×768 friendly</span>
          </div>
        </section>

        <section className="retro-window">
          <div className="retro-titlebar">
            <div className="retro-titlebar-title">All Games</div>
            <div className="retro-titlebar-meta">
              {games.length} in database
            </div>
          </div>
          <div className="retro-window-body">
            {games.length === 0 ? (
              <p className="text-muted-foreground">
                No games ingested yet. Search for a game above to add your first
                one.
              </p>
            ) : (
              <GamesGrid initialGames={games} />
            )}
          </div>
          <div className="retro-statusbar">
            <span>Tip: Click a game to open</span>
            <span className="opacity-80">Scroll to load more</span>
          </div>
        </section>
      </div>
    </main>
  );
}
