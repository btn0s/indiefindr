import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";
import { db } from "@/db";
import { profilesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user already has a profile
  const existingProfile = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, user.id))
    .limit(1);

  // If user has a profile with a username, they've already completed this step
  if (existingProfile.length > 0 && existingProfile[0].username) {
    // Redirect to the next step
    redirect("/onboarding/games");
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Set Up Your Profile</h2>
        <p className="text-muted-foreground mb-6">
          Tell us a bit about yourself. You can always update this information later.
        </p>
        
        <ProfileSetupForm userId={user.id} />
        
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Want to skip this step? <a href="/onboarding/games" className="text-primary hover:underline">Continue to the next step</a>
        </div>
      </div>
    </div>
  );
}

