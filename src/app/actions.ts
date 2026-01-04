"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GameNew } from "@/lib/supabase/types";
import { isLikelyIndie, isRecent } from "@/lib/utils/indie-detection";

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

  // Sort to prioritize indie games (same logic as home page):
  // 1. Recent indie games (last 6 months) - highest priority
  // 2. Other indie games
  // 3. Non-indie games - lowest priority
  // Within each group, sort by number of suggestions, then by date
  return (games as GameNew[]).sort((a, b) => {
    const indieA = isLikelyIndie(a);
    const indieB = isLikelyIndie(b);
    const recentA = isRecent(a, 6);
    const recentB = isRecent(b, 6);

    // Priority 1: Recent indie games
    if (recentA && indieA && !(recentB && indieB)) return -1;
    if (recentB && indieB && !(recentA && indieA)) return 1;

    // Priority 2: Other indie games
    if (indieA && !indieB) return -1;
    if (indieB && !indieA) return 1;

    // Within same priority group, sort by number of suggestions
    const aCount = Array.isArray(a.suggested_game_appids) ? a.suggested_game_appids.length : 0;
    const bCount = Array.isArray(b.suggested_game_appids) ? b.suggested_game_appids.length : 0;
    if (bCount !== aCount) return bCount - aCount;

    // Tiebreaker: most recently created first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
