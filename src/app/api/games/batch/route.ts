import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BatchGamesSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiDatabaseError,
  apiInternalError,
} from "@/lib/api/responses";
import { API_CONFIG } from "@/lib/config";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = await request.json();
    const input = BatchGamesSchema.parse(body);

    const unique = Array.from(new Set(input.appids)).slice(
      0,
      API_CONFIG.BATCH_MAX_APPIDS
    );

    if (unique.length === 0) {
      return apiValidationError(
        new ZodError([
          {
            code: "custom",
            path: ["appids"],
            message: "No valid app IDs provided after parsing",
          },
        ])
      );
    }

    const { data, error } = await supabase
      .from("games_new")
      .select(
        "appid, title, header_image, screenshots, videos, short_description, long_description, raw, suggested_game_appids, created_at, updated_at"
      )
      .in("appid", unique);

    if (error) {
      return apiDatabaseError(error.message);
    }

    return apiSuccess({ games: data || [] });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return apiInternalError(message);
  }
}
