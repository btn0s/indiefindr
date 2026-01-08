import { getSupabaseServerClient } from "./supabase/server";
import type {
  Collection,
  CollectionWithPreview,
  GameCardGame,
  GameNew,
} from "./supabase/types";

export async function getPinnedHomeCollections(): Promise<CollectionWithPreview[]> {
  const supabase = getSupabaseServerClient();

  const { data: pins, error: pinsError } = await supabase
    .from("collection_pins")
    .select("collection_id, position")
    .eq("context", "home")
    .order("position", { ascending: true });

  if (pinsError || !pins || pins.length === 0) {
    return [];
  }

  const collectionIds = pins.map((p) => p.collection_id);

  const [collectionsResult, collectionGamesResult] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .in("id", collectionIds)
      .eq("published", true),
    supabase
      .from("collection_games")
      .select("collection_id, appid, position")
      .in("collection_id", collectionIds)
      .order("collection_id", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  const { data: collections, error: collectionsError } = collectionsResult;
  const { data: collectionGames, error: gamesError } = collectionGamesResult;

  if (collectionsError || !collections || collections.length === 0) {
    return [];
  }

  const collectionMap = new Map<string, Collection>();
  collections.forEach((c) => collectionMap.set(c.id, c));

  const appIdsByCollection = new Map<string, number[]>();
  const totalCountsByCollection = new Map<string, number>();
  
  if (!gamesError && collectionGames) {
    for (const row of collectionGames) {
      const totalCount = totalCountsByCollection.get(row.collection_id) ?? 0;
      totalCountsByCollection.set(row.collection_id, totalCount + 1);
      
      const list = appIdsByCollection.get(row.collection_id) ?? [];
      if (list.length < 4) {
        list.push(row.appid);
        appIdsByCollection.set(row.collection_id, list);
      }
    }
  }

  const uniquePreviewAppIds = [...new Set(Array.from(appIdsByCollection.values()).flat())];

  const gamesByAppId = new Map<number, GameCardGame>();
  if (uniquePreviewAppIds.length > 0) {
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("appid, title, header_image")
      .in("appid", uniquePreviewAppIds);

    if (!gamesDataError && games) {
      for (const g of games) {
        gamesByAppId.set(g.appid, {
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
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
      .map((appid) => gamesByAppId.get(appid))
      .filter((g): g is GameCardGame => g !== undefined);
    const totalCount = totalCountsByCollection.get(collection.id) ?? 0;
    results.push({ ...collection, preview_games: orderedGames, total_games_count: totalCount });
  }

  return results;
}

export async function getPinnedCollectionsForGame(
  appid: number
): Promise<CollectionWithPreview[]> {
  const supabase = getSupabaseServerClient();

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

  const [collectionsResult, collectionGamesResult] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .in("id", collectionIds)
      .eq("published", true),
    supabase
      .from("collection_games")
      .select("collection_id, appid, position")
      .in("collection_id", collectionIds)
      .order("collection_id", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  const { data: collections, error: collectionsError } = collectionsResult;
  const { data: collectionGames, error: gamesError } = collectionGamesResult;

  if (collectionsError || !collections || collections.length === 0) {
    return [];
  }

  const collectionMap = new Map<string, Collection>();
  collections.forEach((c) => collectionMap.set(c.id, c));

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

  const uniquePreviewAppIds = [...new Set(Array.from(appIdsByCollection.values()).flat())];

  const gamesByAppId = new Map<number, GameCardGame>();
  if (uniquePreviewAppIds.length > 0) {
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("appid, title, header_image")
      .in("appid", uniquePreviewAppIds);

    if (!gamesDataError && games) {
      for (const g of games) {
        gamesByAppId.set(g.appid, {
          appid: g.appid,
          title: g.title,
          header_image: g.header_image,
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

export async function getCollectionGames(
  collectionId: string
): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();

  const { data: collectionGames, error: gamesError } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true });

  if (gamesError || !collectionGames || collectionGames.length === 0) {
    return [];
  }

  const appIds = collectionGames.map((cg) => cg.appid);

  const { data: games, error: gamesDataError } = await supabase
    .from("games_new")
    .select("*")
    .in("appid", appIds);

  if (gamesDataError || !games) {
    return [];
  }

  const gamesMap = new Map(games.map((g) => [g.appid, g]));
  return appIds
    .map((appid) => gamesMap.get(appid))
    .filter((g): g is GameNew => g !== undefined);
}
