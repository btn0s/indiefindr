"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { suggestGamesVibe } from "@/lib/suggest";

export type GenerateSuggestionsResult = {
  success: boolean;
  count: number;
  error?: string;
};

export async function generateSuggestions(
  appId: number,
  overwrite: boolean = true
): Promise<GenerateSuggestionsResult> {
  const supabase = await getSupabaseServerClient();

  const { data: game } = await supabase
    .from("games_new")
    .select("title, short_description, developers")
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
      game.developers || undefined,
      10
    );

    if (result.suggestions.length === 0) {
      return { success: false, count: 0, error: "No suggestions generated" };
    }

    // Filter out unverified suggestions (hallucinations)
    const verifiedSuggestions = result.suggestions.filter((s) => {
      // Only include suggestions that were validated (have appId)
      // Unverified suggestions are filtered out here
      return s.appId && s.appId > 0;
    });

    if (verifiedSuggestions.length === 0) {
      return { success: false, count: 0, error: "No verified suggestions generated" };
    }

    const rows = verifiedSuggestions.map((s) => ({
      source_appid: appId,
      suggested_appid: s.appId,
      reason: s.explanation,
    }));

    if (overwrite) {
      // Delete all existing suggestions for this game (force overwrite)
      const { error: deleteError } = await supabase
        .from("game_suggestions")
        .delete()
        .eq("source_appid", appId);

      if (deleteError) {
        return { success: false, count: 0, error: deleteError.message };
      }

      // Insert new suggestions
      const { error } = await supabase
        .from("game_suggestions")
        .insert(rows);

      if (error) {
        return { success: false, count: 0, error: error.message };
      }
    } else {
      // Merge mode: upsert (update existing, insert new)
      const { error } = await supabase
        .from("game_suggestions")
        .upsert(rows, { onConflict: "source_appid,suggested_appid" });

      if (error) {
        return { success: false, count: 0, error: error.message };
      }
    }

    return { success: true, count: verifiedSuggestions.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, count: 0, error: message };
  }
}
