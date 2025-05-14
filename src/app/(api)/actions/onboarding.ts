"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { profilesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function completeOnboarding() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Update the profile to mark onboarding as completed
    await db
      .update(profilesTable)
      .set({ 
        hasCompletedOnboarding: true,
        updatedAt: new Date()
      })
      .where(eq(profilesTable.id, user.id));

    return { success: true };
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return { success: false, error: "Failed to complete onboarding" };
  }
}

export async function completeOnboardingAndRedirect() {
  const result = await completeOnboarding();
  
  if (result.success) {
    redirect("/");
  } else {
    // If there's an error, still redirect to the feed but don't mark onboarding as complete
    redirect("/?onboarding_error=true");
  }
}

