import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toggleSaveGame } from "@/lib/actions/saved-lists";

// Legacy API route - now delegates to server action
// This route is kept for backward compatibility but SaveButton now calls toggleSaveGame directly
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

    // Delegate to server action (which now uses collections)
    const result = await toggleSaveGame(appid, userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ saved: result.saved ?? false });
  } catch (error) {
    console.error("Error in POST /api/saved:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
