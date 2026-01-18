import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCollectionBySlug, getCollectionGames } from "@/lib/collections";
import { GameCardAsync } from "@/components/GameCardAsync";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return { title: "Collection Not Found" };
  }

  const games = await getCollectionGames(collection.id);
  const gameCount = games.length;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/collections/${slug}`;

  const title = `${collection.title} — IndieFindr`;
  const description = collection.description
    ? `Browse ${gameCount} indie games in ${collection.title}. ${collection.description}`
    : `Explore ${collection.title} - a curated collection of ${gameCount} indie games.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const [games, allGamesData] = await Promise.all([
    getCollectionGames(collection.id),
    (async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("games_new_home")
        .select("appid, title, header_image")
        .order("home_bucket", { ascending: true })
        .order("created_at", { ascending: false })
        .order("appid", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (error) {
        console.error("Error loading all games:", error);
        return [];
      }

      return (data || [])
        .filter((g): g is typeof g & { appid: number; title: string } =>
          g.appid !== null && g.title !== null
        )
        .map((g) => ({
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
        }));
    })(),
  ]);

  const allGames: GameCardGame[] = allGamesData;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

  // Structured data schemas
  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title,
    description: collection.description || undefined,
    url: `${siteUrl}/collections/${collection.slug}`,
    about: {
      "@type": "ItemList",
      numberOfItems: games.length,
      itemListElement: games.map((game, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "VideoGame",
          name: game.title,
          url: `${siteUrl}/games/${game.appid}`,
        },
      })),
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Collections",
        item: `${siteUrl}/collections`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: collection.title,
        item: `${siteUrl}/collections/${collection.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionPageSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{collection.title}</h1>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
        </div>

        {games.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              This collection doesn&apos;t have any games yet.
            </p>
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:underline"
            >
              Browse all games →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {games.map((game) => (
              <GameCardAsync key={game.appid} appid={game.appid} />
            ))}
          </div>
        )}

        <hr className="border-border" />

        <div className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xl">All Games</h2>
          </div>
          <div>
            {allGames.length === 0 ? (
              <p className="text-muted-foreground">
                No games ingested yet. Search for a game above to add your first
                one.
              </p>
            ) : (
              <GameGrid initialGames={allGames} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
