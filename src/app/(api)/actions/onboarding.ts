"use server";

import { createClient } from "@/utils/supabase/server";
import { DefaultUserService } from "@/services/user-service";
import { redirect } from "next/navigation";

const userService = new DefaultUserService();

export async function completeOnboarding(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("completeOnboarding Action: User not authenticated.");
      return { success: false, error: "Not authenticated" };
    }

    const result = await userService.markOnboardingAsCompleted(user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to complete onboarding via service.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in completeOnboarding action:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred in the action.",
    };
  }
}

export async function completeOnboardingAndRedirect() {
  const result = await completeOnboarding();

  if (result.success) {
    redirect("/");
  } else {
    const queryParams = new URLSearchParams();
    if (result.error) {
      queryParams.set("onboarding_error_message", result.error);
    }
    redirect(`/?${queryParams.toString()}`);
  }
}

