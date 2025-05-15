"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DefaultUserService,
  ServiceProfileUpdatePayload,
} from "@/lib/services/user-service";
import { z } from "zod";

// Define a schema for input validation using Zod
const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(50, "Username cannot exceed 50 characters"),
  fullName: z
    .string()
    .max(100, "Full name cannot exceed 100 characters")
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(500, "Bio cannot exceed 500 characters")
    .optional()
    .nullable(),
  avatarUrl: z.string().url("Invalid URL for avatar").optional().nullable(),
});

// Type for the validated parameters, derived from the Zod schema
// This ensures that the data passed to the service matches what the service expects (ServiceProfileUpdatePayload)
// after validation.
type ValidatedProfileParams = z.infer<typeof profileUpdateSchema>;

const userService = new DefaultUserService(); // Instantiate the service

export async function updateProfile(params: ServiceProfileUpdatePayload) { // params now aligns with ServiceProfileUpdatePayload
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate input params using Zod schema
    // The `params` directly come from the client, so they need validation.
    // The `username` is crucial, so ensure it's part of `params` if it's being updated.
    // If username can be omitted (i.e., not changing it), the schema needs to reflect that (e.g. .optional())
    // For this action, let's assume username is always provided for an update attempt.
    if (!params.username) {
      // This check can be made more robust with Zod if username is conditionally required.
      // For now, if ServiceProfileUpdatePayload makes username optional, this check is good.
      // If the intent is that username MUST be part of this action, schema should reflect that.
    }

    const validationResult = profileUpdateSchema.safeParse(params);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid profile data",
        details: validationResult.error.flatten().fieldErrors,
      };
    }

    const validatedData: ServiceProfileUpdatePayload = validationResult.data;

    // Call the service layer method with the authenticated user's ID and validated data
    const result = await userService.updateUserProfile(user.id, validatedData);

    // The service method now returns { success, error?, profile? }
    return result; // Directly return the service method's result
  } catch (error) {
    console.error("Error in updateProfile action:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected server error occurred in the action.",
    };
  }
}
