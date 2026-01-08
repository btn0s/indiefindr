import { NextRequest } from "next/server";
import { refreshSuggestions, clearSuggestions } from "@/lib/ingest";
import { IS_DEV } from "@/lib/utils/dev";
import { AppIdSchema } from "@/lib/api/schemas";
import {
  apiSuccess,
  apiValidationError,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from "@/lib/api/responses";
import { ZodError } from "zod";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const { appid } = await params;

    const parseResult = AppIdSchema.safeParse(appid);
    if (!parseResult.success) {
      return apiValidationError(parseResult.error);
    }

    const appId = parseResult.data;

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    if (force && !IS_DEV) {
      return apiForbidden("Force refresh is dev-only");
    }

    if (force) {
      console.log(`[REFRESH] Force mode: clearing suggestions for ${appId}`);
      await clearSuggestions(appId);
    }

    const result = await refreshSuggestions(appId);

    return apiSuccess({
      suggestions: result.suggestions,
      newCount: result.newCount,
      totalCount: result.suggestions.length,
      missingCount: result.missingCount,
      missingAppIds: result.missingAppIds,
      forced: force,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    console.error("[REFRESH SUGGESTIONS] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found")) {
      return apiNotFound("Game");
    }

    return apiInternalError(message);
  }
}
