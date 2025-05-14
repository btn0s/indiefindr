import { NextResponse } from "next/server";
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  try {
    // Get form data
    const formData = await request.formData();
    const appid = formData.get("appid") as string;
    const name = formData.get("name") as string;
    const userId = formData.get("userId") as string;

    // Validate inputs
    if (!appid) {
      return NextResponse.json(
        { error: "Steam App ID is required" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in to claim finds" },
        { status: 401 }
      );
    }

    // Use the user ID from the session for security (not the form data)
    console.log(`[API /claim-find] User ${user.id} claiming find for AppID: ${appid}`);

    // Call the enrichment function to add the game to the database
    await enrichSteamAppId(appid, user.id);

    // Redirect to the search page with a success message
    return NextResponse.json({ 
      success: true, 
      message: `Successfully claimed "${name}" as your find!` 
    });
  } catch (error: any) {
    console.error("[API /claim-find] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to claim find", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
