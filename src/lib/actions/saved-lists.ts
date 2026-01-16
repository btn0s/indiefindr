"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getUsernameByUserId } from "./profiles";
import type { Collection } from "@/lib/supabase/types";

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getDefaultSavedCollection(): Promise<Collection | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

// Legacy alias for backward compatibility
export async function getDefaultSavedList(userId?: string): Promise<Collection | null> {
  // If userId is provided, use it (for backward compat during migration)
  // Otherwise derive from auth
  const effectiveUserId = userId ?? (await getCurrentUserId());
  if (!effectiveUserId) {
    return null;
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("owner_id", effectiveUserId)
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getCollectionGameAppids(collectionId: string): Promise<number[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.appid);
}

// Legacy alias for backward compatibility
export async function getSavedListGames(listId: string): Promise<number[]> {
  return getCollectionGameAppids(listId);
}

export async function getSavedListGamesData(listId: string) {
  const supabase = await getSupabaseServerClient();

  const { data: savedGames, error: gamesError } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", listId)
    .order("created_at", { ascending: false });

  if (gamesError || !savedGames || savedGames.length === 0) {
    return [];
  }

  const appIds = savedGames.map((sg) => sg.appid);

  const { data: games, error: gamesDataError } = await supabase
    .from("games_new")
    .select("appid, title, header_image")
    .in("appid", appIds);

  if (gamesDataError || !games) {
    return [];
  }

  const gamesMap = new Map(games.map((g) => [g.appid, g]));
  return appIds
    .map((appid) => gamesMap.get(appid))
    .filter((g): g is { appid: number; title: string; header_image: string | null } => g !== undefined);
}

export async function isGameSaved(appid: number, userId?: string): Promise<boolean> {
  const effectiveUserId = userId ?? (await getCurrentUserId());
  if (!effectiveUserId) {
    return false;
  }

  const supabase = await getSupabaseServerClient();

  const { data: list } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", effectiveUserId)
    .eq("is_default", true)
    .maybeSingle();

  if (!list) {
    return false;
  }

  const { data } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", list.id)
    .eq("appid", appid)
    .maybeSingle();

  return !!data;
}

export async function toggleSaveGame(appid: number, userId?: string) {
  const effectiveUserId = userId ?? (await getCurrentUserId());
  if (!effectiveUserId) {
    return { error: "You must be signed in to save games" };
  }

  const supabase = await getSupabaseServerClient();

  // Get or create default collection
  let { data: list } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", effectiveUserId)
    .eq("is_default", true)
    .maybeSingle();

  if (!list) {
    const { data: newList, error: createError } = await supabase
      .from("collections")
      .insert({
        owner_id: effectiveUserId,
        title: "Saved",
        is_default: true,
        is_public: true,
        published: false,
        pinned_to_home: false,
        home_position: 0,
      })
      .select("id")
      .single();

    if (createError) {
      return { error: `Could not create saved collection: ${createError.message}` };
    }

    if (!newList) {
      return { error: "Could not create saved collection: No data returned" };
    }

    list = newList;
  }

  // Check if game is already saved
  const { data: existing } = await supabase
    .from("collection_games")
    .select("appid")
    .eq("collection_id", list.id)
    .eq("appid", appid)
    .maybeSingle();

  if (existing) {
    // Remove from collection
    const { error: deleteError } = await supabase
      .from("collection_games")
      .delete()
      .eq("collection_id", list.id)
      .eq("appid", appid);

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath("/saved");
    revalidatePath(`/games/${appid}`);
    return { saved: false };
  } else {
    // Add to collection
    const { error: insertError } = await supabase
      .from("collection_games")
      .insert({
        collection_id: list.id,
        appid,
        position: 0,
      });

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath("/saved");
    revalidatePath(`/games/${appid}`);
    return { saved: true };
  }
}

export async function updateCollectionVisibility(
  collectionId: string,
  isPublic: boolean
): Promise<{ success?: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "You must be signed in to update collection visibility" };
  }

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("collections")
    .update({ is_public: isPublic })
    .eq("id", collectionId)
    .eq("owner_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/saved");
  revalidatePath(`/lists/${collectionId}`);
  return { success: true };
}

// Legacy alias for backward compatibility
export async function updateSavedListVisibility(
  userId: string,
  listId: string,
  isPublic: boolean
): Promise<{ success?: boolean; error?: string }> {
  // Verify userId matches current user (security check)
  const currentUserId = await getCurrentUserId();
  if (!currentUserId || currentUserId !== userId) {
    return { error: "Unauthorized" };
  }

  return updateCollectionVisibility(listId, isPublic);
}

export async function getSavedListShareUrl(listId: string, ownerId: string): Promise<string> {
  const username = await getUsernameByUserId(ownerId);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  
  if (username) {
    return `${baseUrl}/@${username}/saved`;
  }
  
  return `${baseUrl}/lists/${listId}`;
}
