import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GamesGrid } from "@/components/GamesGrid";
import { getPinnedHomeCollections } from "@/lib/collections";
import { CollectionsSection } from "@/components/CollectionsSection";

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

export default async function Home() {
  const supabase = getSupabaseServerClient();
  const [games, pinnedCollections] = await Promise.all([
    (async () => {
      const { data, error } = await supabase
        .from("games_new_home")
        .select(
          "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
        )
        .order("home_bucket", { ascending: true })
        .order("suggestions_count", { ascending: false })
        .order("created_at", { ascending: false })
        .order("appid", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (error) {
        console.error("Error loading games:", error);
        return [];
      }

      return (data || []);
    })(),
    getPinnedHomeCollections(),
  ]);

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="w-full">
        <div className="container mx-auto max-w-4xl w-full">
          <h1 className="text-balance font-semibold tracking-tight text-3xl sm:text-4xl">
            Find your next favorite indie game
          </h1>
        </div>
      </div>

      {/* Pinned Collections Section */}
      {pinnedCollections.length > 0 && (
        <CollectionsSection collections={pinnedCollections} />
      )}

      {/* Full-width grid section */}
      <div className="flex flex-col gap-4 w-full">
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
