import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appid, accessToken } = body;

    if (!appid || typeof appid !== "number") {
      return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Get user from access token
    let userId: string | null = null;

    if (accessToken) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        });
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // Token invalid or expired
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = getSupabaseServiceClient();

    let { data: list } = await serviceClient
      .from("saved_lists")
      .select("id")
      .eq("owner_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (!list) {
      const { data: newList, error: createError } = await serviceClient
        .from("saved_lists")
        .insert({
          owner_id: userId,
          title: "Saved",
          is_default: true,
          is_public: true,
        })
        .select("id")
        .single();

      if (createError) {
        return NextResponse.json(
          { error: `Could not create saved list: ${createError.message}` },
          { status: 500 }
        );
      }

      if (!newList) {
        return NextResponse.json(
          { error: "Could not create saved list: No data returned" },
          { status: 500 }
        );
      }

      list = newList;
    }

    const { data: deleted, error: deleteError } = await serviceClient
      .from("saved_list_games")
      .delete()
      .eq("list_id", list.id)
      .eq("appid", appid)
      .select("appid");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (deleted && deleted.length > 0) {
      return NextResponse.json({ saved: false });
    }

    const { error: insertError } = await serviceClient.from("saved_list_games").insert({
      list_id: list.id,
      appid,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Error in POST /api/saved:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
