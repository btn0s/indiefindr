import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppIdSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiNotFound,
  apiInternalError,
} from "@/lib/api/responses";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
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

    const { data: game, error } = await supabase
      .from("games_new")
      .select("*")
      .eq("appid", appId)
      .maybeSingle();

    if (error) {
      return apiInternalError(error.message);
    }

    if (!game) {
      return apiNotFound("Game");
    }

    return apiSuccess(game);
  } catch (error) {
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return apiInternalError(errorMessage);
  }
}
