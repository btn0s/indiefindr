import { getSupabaseServerClient } from "./supabase/server";
import type {
  Collection,
  CollectionWithPreview,
  GameCardGame,
  GameNew,
} from "./supabase/types";

/**
 * Get collections pinned to the home page, ordered by position.
 * Includes all games from each collection (for display as GameCard components).
 */
export async function getPinnedHomeCollections(): Promise<
  CollectionWithPreview[]
> {
  const supabase = getSupabaseServerClient();

  // Fetch pins for home context, ordered by position
  const { data: pins, error: pinsError } = await supabase
    .from("collection_pins")
    .select("collection_id, position")
    .eq("context", "home")
    .order("position", { ascending: true });

  if (pinsError || !pins || pins.length === 0) {
    return [];
  }

  const collectionIds = pins.map((p) => p.collection_id);

  // Fetch collections
  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("*")
    .in("id", collectionIds)
    .eq("published", true);

  if (collectionsError || !collections || collections.length === 0) {
    return [];
  }

  // Create a map for quick lookup and preserve pin order
  const collectionMap = new Map<string, Collection>();
  collections.forEach((c) => collectionMap.set(c.id, c));

  // Fetch all collection games for pinned collections in one go, then take top 4 per collection.
  const { data: collectionGames, error: gamesError } = await supabase
    .from("collection_games")
    .select("collection_id, appid, position")
    .in("collection_id", collectionIds)
    .order("collection_id", { ascending: true })
    .order("position", { ascending: true });

  const appIdsByCollection = new Map<string, number[]>();
  if (!gamesError && collectionGames) {
    for (const row of collectionGames) {
      const list = appIdsByCollection.get(row.collection_id) ?? [];
      if (list.length < 4) {
        list.push(row.appid);
        appIdsByCollection.set(row.collection_id, list);
      }
    }
  }

  const allPreviewAppIds = Array.from(appIdsByCollection.values()).flat();
  const uniquePreviewAppIds = Array.from(new Set(allPreviewAppIds));

  const gamesByAppId = new Map<number, GameCardGame>();
  if (uniquePreviewAppIds.length > 0) {
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("appid, title, header_image, videos")
      .in("appid", uniquePreviewAppIds);

    if (!gamesDataError && games) {
      for (const g of games) {
        gamesByAppId.set(g.appid, {
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
          videos: g.videos,
        });
      }
    }
  }

  // Build results in pin order.
  const results: CollectionWithPreview[] = [];
  for (const pin of pins) {
    const collection = collectionMap.get(pin.collection_id);
    if (!collection) continue;
    const appIds = appIdsByCollection.get(collection.id) ?? [];
    const orderedGames = appIds
      .map((appid) => gamesByAppId.get(appid))
      .filter((g): g is GameCardGame => g !== undefined);
    results.push({ ...collection, preview_games: orderedGames });
  }

  return results;
}

/**
 * Get collections pinned to a specific game page, ordered by position.
 * Includes all games from each collection (for display as GameCard components).
 */
export async function getPinnedCollectionsForGame(
  appid: number
): Promise<CollectionWithPreview[]> {
  const supabase = getSupabaseServerClient();

  // Fetch pins for this game, ordered by position
  const { data: pins, error: pinsError } = await supabase
    .from("collection_pins")
    .select("collection_id, position")
    .eq("context", "game")
    .eq("game_appid", appid)
    .order("position", { ascending: true });

  if (pinsError || !pins || pins.length === 0) {
    return [];
  }

  const collectionIds = pins.map((p) => p.collection_id);

  // Fetch collections
  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("*")
    .in("id", collectionIds)
    .eq("published", true);

  if (collectionsError || !collections || collections.length === 0) {
    return [];
  }

  // Create a map for quick lookup and preserve pin order
  const collectionMap = new Map<string, Collection>();
  collections.forEach((c) => collectionMap.set(c.id, c));

  const { data: collectionGames, error: gamesError } = await supabase
    .from("collection_games")
    .select("collection_id, appid, position")
    .in("collection_id", collectionIds)
    .order("collection_id", { ascending: true })
    .order("position", { ascending: true });

  const appIdsByCollection = new Map<string, number[]>();
  if (!gamesError && collectionGames) {
    for (const row of collectionGames) {
      const list = appIdsByCollection.get(row.collection_id) ?? [];
      if (list.length < 4) {
        list.push(row.appid);
        appIdsByCollection.set(row.collection_id, list);
      }
    }
  }

  const allPreviewAppIds = Array.from(appIdsByCollection.values()).flat();
  const uniquePreviewAppIds = Array.from(new Set(allPreviewAppIds));

  const gamesByAppId = new Map<number, GameCardGame>();
  if (uniquePreviewAppIds.length > 0) {
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("appid, title, header_image, videos")
      .in("appid", uniquePreviewAppIds);

    if (!gamesDataError && games) {
      for (const g of games) {
        gamesByAppId.set(g.appid, {
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
          videos: g.videos,
        });
      }
    }
  }

  const results: CollectionWithPreview[] = [];
  for (const pin of pins) {
    const collection = collectionMap.get(pin.collection_id);
    if (!collection) continue;
    const appIds = appIdsByCollection.get(collection.id) ?? [];
    const orderedGames = appIds
      .map((id) => gamesByAppId.get(id))
      .filter((g): g is GameCardGame => g !== undefined);
    results.push({ ...collection, preview_games: orderedGames });
  }

  return results;
}

/**
 * Get a collection by its slug.
 */
export async function getCollectionBySlug(
  slug: string
): Promise<Collection | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get all games in a collection, ordered by position.
 */
export async function getCollectionGames(
  collectionId: string
): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();

  // Fetch collection games ordered by position
  const { data: collectionGames, error: gamesError } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true });

  if (gamesError || !collectionGames || collectionGames.length === 0) {
    return [];
  }

  const appIds = collectionGames.map((cg) => cg.appid);

  // Fetch game data
  const { data: games, error: gamesDataError } = await supabase
    .from("games_new")
    .select("*")
    .in("appid", appIds);

  if (gamesDataError || !games) {
    return [];
  }

  // Preserve order from collection_games
  return appIds
    .map((appid) => games.find((g) => g.appid === appid))
    .filter((g): g is GameNew => g !== undefined);
}
