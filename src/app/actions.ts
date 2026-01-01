"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GameNew } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

export async function loadMoreGames(offset: number): Promise<GameNew[]> {
  const supabase = getSupabaseServerClient();
  const { data: games, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, header_image, videos, screenshots, short_description, long_description, raw, created_at, updated_at, suggested_game_appids"
    )
    .range(offset, offset + PAGE_SIZE - 1);

  if (error || !games) return [];

  // Sort by suggestions count, then by date
  return (games as GameNew[]).sort((a, b) => {
    const aCount = Array.isArray(a.suggested_game_appids) ? a.suggested_game_appids.length : 0;
    const bCount = Array.isArray(b.suggested_game_appids) ? b.suggested_game_appids.length : 0;
    if (bCount !== aCount) return bCount - aCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
