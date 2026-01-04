import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GamesGrid } from "@/components/GamesGrid";
import { GameNew } from "@/lib/supabase/types";
import {
  PinnedCollectionsRow,
  type PinnedCollectionPreview,
} from "@/components/PinnedCollectionsRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/`;
  const title = "Find Games Like Your Favorites — IndieFindr";
  const description =
    "Discover similar indie games on Steam. Search games, get AI-powered recommendations, and find your next favorite.";
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

async function getPinnedCollections(): Promise<PinnedCollectionPreview[]> {
  const supabase = getSupabaseServerClient();

  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("id, title, description, pinned_rank, created_at")
    .eq("pinned", true)
    .order("pinned_rank", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (collectionsError || !collections) {
    if (collectionsError) {
      console.error("Error loading pinned collections:", collectionsError);
    }
    return [];
  }

  const ids = collections.map((c) => c.id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("collection_items")
    .select("collection_id, games_new(header_image)")
    .in("collection_id", ids)
    .order("created_at", { ascending: false })
    .limit(400);

  if (itemsError) {
    console.error("Error loading collection items:", itemsError);
  }

  const coversById = new Map<string, string[]>();
  for (const row of items || []) {
    const collectionId = row.collection_id as string | undefined;
    const embedded = row.games_new as unknown;
    const game =
      Array.isArray(embedded)
        ? ((embedded[0] as { header_image: string | null } | undefined) ?? null)
        : ((embedded as { header_image: string | null } | null) ?? null);
    const headerImage = game?.header_image ?? null;
    if (!collectionId || !headerImage) continue;

    const existing = coversById.get(collectionId) || [];
    if (existing.length >= 4) continue;
    existing.push(headerImage);
    coversById.set(collectionId, existing);
  }

  return collections.map((c) => ({
    id: c.id as string,
    title: c.title as string,
    description: (c.description as string | null) ?? null,
    coverImages: coversById.get(c.id as string) || [],
  }));
}

export default async function Home() {
  const [games, pinnedCollections] = await Promise.all([
    getGames(),
    getPinnedCollections(),
  ]);

  return (
    <main className="flex flex-col gap-8 pt-8">
      <PinnedCollectionsRow collections={pinnedCollections} />

      {/* Full-width grid section */}
      <div className="flex flex-col gap-4 w-full px-4 pb-8">
        <div className="container mx-auto max-w-7xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">All Games</h2>
        </div>
        <div className="container mx-auto max-w-7xl w-full">
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
