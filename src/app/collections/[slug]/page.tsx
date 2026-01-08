import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCollectionBySlug, getCollectionGames } from "@/lib/collections";
import { GameCardAsync } from "@/components/GameCardAsync";

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

  const title = `${collection.title} — IndieFindr`;
  const description =
    collection.description ||
    `Explore ${collection.title} - a curated collection of indie games.`;

  return {
    title,
    description,
    openGraph: {
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
    </main>
  );
}
