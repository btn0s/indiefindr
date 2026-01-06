import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCollectionBySlug, getCollectionGames } from "@/lib/collections";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return {
      title: "Collection Not Found",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const title = `${collection.title} — IndieFindr`;
  const canonicalPath = `/collections/${slug}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const description =
    collection.description ||
    `Explore ${collection.title} - a curated collection of indie games on Steam.`;

  // Check if collection has games (to avoid soft-404s for empty collections)
  const { data: collectionGames } = await getSupabaseServerClient()
    .from("collection_games")
    .select("collection_id")
    .eq("collection_id", collection.id)
    .limit(1);

  const hasGames = (collectionGames?.length ?? 0) > 0;

  return {
    title,
    description,
    keywords: [
      collection.title,
      "indie games",
      "game collection",
      "curated games",
      "Steam games",
    ],
    alternates: { canonical: canonicalUrl },
    // Add noindex for empty collections to avoid soft-404s
    robots: hasGames ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
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

  const games = await getCollectionGames(collection.id);

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="w-full">
        <div className="container mx-auto max-w-4xl w-full">
          <h1 className="text-balance font-semibold tracking-tight text-3xl sm:text-4xl">
            {collection.title}
          </h1>
          {collection.description && (
            <p className="mt-2 text-muted-foreground text-lg">
              {collection.description}
            </p>
          )}
        </div>
      </div>

      {/* Games Grid */}
      <div className="flex flex-col gap-4 w-full pb-8">
        <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">
            {games.length === 0
              ? "No games yet"
              : `${games.length} ${games.length === 1 ? "game" : "games"}`}
          </h2>
        </div>
        <div className="container mx-auto max-w-4xl w-full">
          {games.length === 0 ? (
            <div className="flex flex-col gap-4 py-8">
              <p className="text-muted-foreground text-lg">
                This collection doesn&apos;t have any games yet.
              </p>
              <p className="text-muted-foreground">
                Check back soon, or explore other collections to discover indie games on Steam.
              </p>
              <div className="pt-4">
                <Link href="/" className="text-sm font-medium text-primary hover:underline">
                  Browse all games →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {games.map((game) => (
                <GameCard key={game.appid} {...game} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
