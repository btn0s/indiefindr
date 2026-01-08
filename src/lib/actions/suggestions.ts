"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { suggestGamesVibe } from "@/lib/suggest-new";

export type GenerateSuggestionsResult = {
  success: boolean;
  count: number;
  error?: string;
};

export async function generateSuggestions(
  appId: number
): Promise<GenerateSuggestionsResult> {
  const supabase = getSupabaseServerClient();

  const { data: game } = await supabase
    .from("games_new")
    .select("title, short_description")
    .eq("appid", appId)
    .single();

  if (!game) {
    return { success: false, count: 0, error: "Game not found" };
  }

  try {
    const result = await suggestGamesVibe(
      appId,
      game.title,
      game.short_description || undefined,
      10
    );

    if (result.suggestions.length === 0) {
      return { success: false, count: 0, error: "No suggestions generated" };
    }

    const rows = result.suggestions.map((s) => ({
      source_appid: appId,
      suggested_appid: s.appId,
      reason: s.explanation,
    }));

    const { error } = await supabase
      .from("game_suggestions")
      .upsert(rows, { onConflict: "source_appid,suggested_appid" });

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: result.suggestions.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, count: 0, error: message };
  }
}
