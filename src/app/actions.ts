"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GameCardGame } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export async function loadMoreGames(offset: number): Promise<GameCardGame[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new_home")
    .select("appid, title, header_image, videos")
    .order("home_bucket", { ascending: true })
    .order("suggestions_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("appid", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return [];

  return (data || []).map((g) => ({
    appid: g.appid,
    title: g.title,
    header_image: g.header_image,
    videos: g.videos,
  })) satisfies GameCardGame[];
}
