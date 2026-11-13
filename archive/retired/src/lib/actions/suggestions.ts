"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { suggestGames } from "@/lib/suggest";
import { SUGGESTION_CONFIG } from "@/lib/config";

export type GenerateSuggestionsResult = {
  success: boolean;
  count: number;
  error?: string;
};

export async function generateSuggestions(
  appId: number,
  overwrite: boolean = true
): Promise<GenerateSuggestionsResult> {
  const supabase = getSupabaseServerClient();

  try {
    const result = await suggestGames(
      appId,
      SUGGESTION_CONFIG.TARGET_SUGGESTION_COUNT
    );

    if (result.suggestions.length === 0) {
      return { success: false, count: 0, error: "No similar games found" };
    }

    const rows = result.suggestions.map((s) => ({
      source_appid: appId,
      suggested_appid: s.appId,
      reason: s.explanation,
    }));

    if (overwrite) {
      const { error: deleteError } = await supabase
        .from("game_suggestions")
        .delete()
        .eq("source_appid", appId);

      if (deleteError) {
        return { success: false, count: 0, error: deleteError.message };
      }

      const { error } = await supabase
        .from("game_suggestions")
        .insert(rows);

      if (error) {
        return { success: false, count: 0, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("game_suggestions")
        .upsert(rows, { onConflict: "source_appid,suggested_appid" });

      if (error) {
        return { success: false, count: 0, error: error.message };
      }
    }

    return { success: true, count: result.suggestions.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, count: 0, error: message };
  }
}
