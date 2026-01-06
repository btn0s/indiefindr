import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appid: string }> }
) {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return new Response("Invalid appid", { status: 400 });
  }

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = getSupabaseServerClient();
      let lastUpdatedAt: string | null = null;
      let consecutiveNoChange = 0;
      const MAX_NO_CHANGE = 30;

      const sendEvent = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const checkForUpdates = async () => {
        if (closed) {
          if (intervalId) clearInterval(intervalId);
          return;
        }

        try {
          const { data, error } = await supabase
            .from("games_new")
            .select("suggested_game_appids, updated_at")
            .eq("appid", appId)
            .maybeSingle();

          if (error) {
            sendEvent({ type: "error", message: error.message });
            return;
          }

          if (!data) {
            sendEvent({ type: "error", message: "Game not found" });
            return;
          }

          const suggestions = data.suggested_game_appids || [];
          const updatedAt = data.updated_at;

          if (updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = updatedAt;
            consecutiveNoChange = 0;
            sendEvent({
              type: "suggestions",
              suggestions,
              updatedAt,
            });

            if (suggestions.length > 0) {
              sendEvent({ type: "complete" });
              closed = true;
              if (intervalId) clearInterval(intervalId);
              controller.close();
              return;
            }
          } else {
            consecutiveNoChange++;
            if (consecutiveNoChange >= MAX_NO_CHANGE) {
              sendEvent({ type: "timeout" });
              closed = true;
              if (intervalId) clearInterval(intervalId);
              controller.close();
              return;
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          sendEvent({ type: "error", message });
        }
      };

      await checkForUpdates();

      if (!closed) {
        intervalId = setInterval(checkForUpdates, 2000);
      }
    },
    cancel() {
      closed = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
