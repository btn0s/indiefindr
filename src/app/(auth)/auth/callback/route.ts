import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profilesTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Check if this is a new user who needs to go through onboarding
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Check if user already has a profile
      const existingProfile = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, user.id))
        .limit(1);

      // If no profile exists, redirect to onboarding
      if (existingProfile.length === 0) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // If profile exists but onboarding not completed, redirect to onboarding
      if (
        existingProfile.length > 0 &&
        !existingProfile[0].hasCompletedOnboarding
      ) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/`);
}
