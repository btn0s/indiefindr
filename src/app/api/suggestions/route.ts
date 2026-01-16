import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appid } = body;

    if (!appid || typeof appid !== "number") {
      return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
    }

    const serviceClient = getSupabaseServiceClient();

    // Check if game exists
    const { data: game } = await serviceClient
      .from("games_new")
      .select("appid")
      .eq("appid", appid)
      .maybeSingle();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Upsert job with status=queued (idempotent per source_appid)
    const { data: job, error } = await serviceClient
      .from("suggestion_jobs")
      .upsert(
        {
          source_appid: appid,
          status: "queued",
          error: null,
          started_at: null,
          finished_at: null,
        },
        {
          onConflict: "source_appid",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error creating suggestion job:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    console.error("Error in POST /api/suggestions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appid = searchParams.get("appid");

    if (!appid) {
      return NextResponse.json({ error: "appid required" }, { status: 400 });
    }

    const appIdNum = parseInt(appid, 10);
    if (isNaN(appIdNum)) {
      return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Check if suggestions already exist (completion condition)
    const { data: suggestions } = await supabase
      .from("game_suggestions")
      .select("suggested_appid")
      .eq("source_appid", appIdNum)
      .limit(1);

    const hasSuggestions = suggestions && suggestions.length > 0;

    // Get job status
    const { data: job } = await supabase
      .from("suggestion_jobs")
      .select("status, error")
      .eq("source_appid", appIdNum)
      .maybeSingle();

    const status = job?.status || (hasSuggestions ? "succeeded" : null);
    const done = hasSuggestions || status === "succeeded" || status === "failed";

    return NextResponse.json({
      status,
      done,
      error: job?.error || null,
      hasSuggestions,
    });
  } catch (error) {
    console.error("Error in GET /api/suggestions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
