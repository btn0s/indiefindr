import type { MetadataRoute } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseServerClient();
  const entries: MetadataRoute.Sitemap = [];

  // Home page
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1.0,
  });

  // Fetch all games that have content (title exists = game is ingested)
  const { data: games, error: gamesError } = await supabase
    .from("games_new")
    .select("appid, updated_at")
    .not("title", "is", null)
    .order("updated_at", { ascending: false });

  if (!gamesError && games) {
    for (const game of games) {
      entries.push({
        url: `${SITE_URL}/games/${game.appid}`,
        lastModified: game.updated_at ? new Date(game.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Fetch all published collections that have at least one game
  // This avoids soft-404s from empty collections
  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("slug, updated_at, id")
    .eq("published", true)
    .order("updated_at", { ascending: false });

  if (!collectionsError && collections) {
    // Check which collections have games
    const collectionIds = collections.map((c) => c.id);
    const { data: collectionGames } = await supabase
      .from("collection_games")
      .select("collection_id")
      .in("collection_id", collectionIds);

    const collectionsWithGames = new Set<string>();
    if (collectionGames) {
      for (const cg of collectionGames) {
        collectionsWithGames.add(cg.collection_id);
      }
    }

    // Only include collections that have games
    for (const collection of collections) {
      if (collectionsWithGames.has(collection.id)) {
        entries.push({
          url: `${SITE_URL}/collections/${collection.slug}`,
          lastModified: collection.updated_at
            ? new Date(collection.updated_at)
            : new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  }

  return entries;
}
