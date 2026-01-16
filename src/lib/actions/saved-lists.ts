"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { getUsernameByUserId } from "./profiles";

export async function getDefaultSavedList(userId: string) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getSavedListGames(listId: string) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("saved_list_games")
    .select("appid")
    .eq("list_id", listId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.appid);
}

export async function getSavedListGamesData(listId: string) {
  const supabase = getSupabaseServerClient();

  const { data: savedGames, error: gamesError } = await supabase
    .from("saved_list_games")
    .select("appid")
    .eq("list_id", listId)
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

export async function isGameSaved(userId: string, appid: number): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: list } = await supabase
    .from("saved_lists")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (!list) {
    return false;
  }

  const { data } = await supabase
    .from("saved_list_games")
    .select("appid")
    .eq("list_id", list.id)
    .eq("appid", appid)
    .maybeSingle();

  return !!data;
}

export async function toggleSaveGame(userId: string, appid: number) {
  const serviceClient = getSupabaseServiceClient();

  let { data: list } = await serviceClient
    .from("saved_lists")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (!list) {
    const { data: newList, error: createError } = await serviceClient
      .from("saved_lists")
      .insert({
        owner_id: userId,
        title: "Saved",
        is_default: true,
        is_public: true,
      })
      .select("id")
      .single();

    if (createError) {
      return { error: `Could not create saved list: ${createError.message}` };
    }

    if (!newList) {
      return { error: "Could not create saved list: No data returned" };
    }

    list = newList;
  }

  const { data: deleted, error: deleteError } = await serviceClient
    .from("saved_list_games")
    .delete()
    .eq("list_id", list.id)
    .eq("appid", appid)
    .select("appid");

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (deleted && deleted.length > 0) {
    revalidatePath("/saved");
    revalidatePath(`/games/${appid}`);
    return { saved: false };
  }

  const { error: insertError } = await serviceClient.from("saved_list_games").insert({
    list_id: list.id,
    appid,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/saved");
  revalidatePath(`/games/${appid}`);
  return { saved: true };
}

export async function updateSavedListVisibility(
  userId: string,
  listId: string,
  isPublic: boolean
) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("saved_lists")
    .update({ is_public: isPublic })
    .eq("id", listId)
    .eq("owner_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/saved");
  revalidatePath(`/lists/${listId}`);
  return { success: true };
}

export async function getSavedListShareUrl(listId: string, ownerId: string): Promise<string> {
  const username = await getUsernameByUserId(ownerId);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  
  if (username) {
    return `${baseUrl}/@${username}/saved`;
  }
  
  return `${baseUrl}/lists/${listId}`;
}
