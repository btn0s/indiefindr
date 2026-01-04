"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GameNew } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export async function loadMoreGames(offset: number): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new_home")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
    )
    .order("home_bucket", { ascending: true })
    .order("suggestions_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("appid", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return [];
  return (data || []) as GameNew[];
}
