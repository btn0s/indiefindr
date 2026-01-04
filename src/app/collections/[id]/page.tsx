import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Collection, GameNew } from "@/lib/supabase/types";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

async function getCollection(id: string): Promise<Collection | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("collections")
    .select("id, title, description, pinned, pinned_rank, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error loading collection:", error);
    return null;
  }
  return (data as Collection | null) ?? null;
}

async function getCollectionGames(id: string): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("collection_items")
    .select(
      "created_at, games_new(appid, title, header_image, screenshots, videos, short_description, long_description, raw, suggested_game_appids, created_at, updated_at)"
    )
    .eq("collection_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading collection items:", error);
    return [];
  }

  return (data || [])
    .map((row) => {
      const embedded = row.games_new as unknown;
      if (Array.isArray(embedded)) {
        return (embedded[0] as GameNew | undefined) ?? null;
      }
      return (embedded as GameNew | null) ?? null;
    })
    .filter((g): g is GameNew => !!g);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return { title: "Collection Not Found" };
  }

  const collection = await getCollection(parsed.data);
  if (!collection) {
    return { title: "Collection Not Found", robots: { index: false, follow: false } };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/collections/${collection.id}`;

  return {
    title: `${collection.title} — IndieFindr`,
    description: collection.description ?? undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${collection.title} — IndieFindr`,
      description: collection.description ?? undefined,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
  };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const [collection, games] = await Promise.all([
    getCollection(parsed.data),
    getCollectionGames(parsed.data),
  ]);

  if (!collection) notFound();

  return (
    <main className="container mx-auto max-w-7xl px-4 py-6 sm:py-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Home
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <span className="text-foreground">{collection.title}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold leading-snug text-balance">
          {collection.title}
        </h1>

        {collection.description ? (
          <p className="text-muted-foreground max-w-3xl">
            {collection.description}
          </p>
        ) : null}
      </div>

      {games.length === 0 ? (
        <p className="text-muted-foreground">
          This collection doesn’t have any games yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {games.map((game) => (
            <GameCard key={game.appid} {...game} />
          ))}
        </div>
      )}
    </main>
  );
}

