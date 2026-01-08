import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppIdSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiNotFound,
  apiDatabaseError,
} from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { appid } = await params;

    const parseResult = AppIdSchema.safeParse(appid);
    if (!parseResult.success) {
      return apiValidationError(parseResult.error);
    }

    const appId = parseResult.data;

    const { data, error } = await supabase
      .from("games_new")
      .select("appid, title, suggested_game_appids, updated_at")
      .eq("appid", appId)
      .maybeSingle();

    if (error) {
      return apiDatabaseError(error.message);
    }

    if (!data) {
      return apiNotFound("Game");
    }

    return apiSuccess({
      appid: data.appid,
      title: data.title,
      suggestions: data.suggested_game_appids || [],
      updatedAt: data.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return apiDatabaseError(message);
  }
}
