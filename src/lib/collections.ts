import { getSupabaseServerClient } from "./supabase/server";
import type {
  Collection,
  CollectionWithPreview,
  GameNew,
  CollectionPin,
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

  // Fetch all games for each collection (ordered by position)
  const results: CollectionWithPreview[] = [];

  for (const pin of pins) {
    const collection = collectionMap.get(pin.collection_id);
    if (!collection) continue;

    // Fetch top 4 games for the collection
    const { data: collectionGames, error: gamesError } = await supabase
      .from("collection_games")
      .select("appid")
      .eq("collection_id", collection.id)
      .order("position", { ascending: true })
      .limit(4);

    if (gamesError || !collectionGames || collectionGames.length === 0) {
      results.push({ ...collection, preview_games: [] });
      continue;
    }

    const appIds = collectionGames.map((cg) => cg.appid);

    // Fetch game data
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("*")
      .in("appid", appIds);

    if (gamesDataError || !games) {
      results.push({ ...collection, preview_games: [] });
      continue;
    }

    // Preserve order from collection_games
    const orderedGames = appIds
      .map((appid) => games.find((g) => g.appid === appid))
      .filter((g): g is GameNew => g !== undefined);

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

  // Fetch all games for each collection (ordered by position)
  const results: CollectionWithPreview[] = [];

  for (const pin of pins) {
    const collection = collectionMap.get(pin.collection_id);
    if (!collection) continue;

    // Fetch top 4 games for the collection
    const { data: collectionGames, error: gamesError } = await supabase
      .from("collection_games")
      .select("appid")
      .eq("collection_id", collection.id)
      .order("position", { ascending: true })
      .limit(4);

    if (gamesError || !collectionGames || collectionGames.length === 0) {
      results.push({ ...collection, preview_games: [] });
      continue;
    }

    const appIds = collectionGames.map((cg) => cg.appid);

    // Fetch game data
    const { data: games, error: gamesDataError } = await supabase
      .from("games_new")
      .select("*")
      .in("appid", appIds);

    if (gamesDataError || !games) {
      results.push({ ...collection, preview_games: [] });
      continue;
    }

    // Preserve order from collection_games
    const orderedGames = appIds
      .map((appid) => games.find((g) => g.appid === appid))
      .filter((g): g is GameNew => g !== undefined);

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
