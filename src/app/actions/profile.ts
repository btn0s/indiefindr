"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { profilesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

interface ProfileUpdateParams {
  username: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  hasCompletedOnboarding?: boolean;
}

export async function updateProfile(params: ProfileUpdateParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if username is already taken
    if (params.username) {
      const existingUser = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.username, params.username))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== user.id) {
        return { success: false, error: "Username is already taken" };
      }
    }

    // Update or create profile
    const updateData = {
      username: params.username,
      fullName: params.fullName || null,
      bio: params.bio || null,
      avatarUrl: params.avatarUrl || null,
      updatedAt: new Date(),
      ...(params.hasCompletedOnboarding !== undefined && { 
        hasCompletedOnboarding: params.hasCompletedOnboarding 
      }),
    };

    // Check if profile exists
    const existingProfile = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, user.id))
      .limit(1);

    if (existingProfile.length > 0) {
      // Update existing profile
      await db
        .update(profilesTable)
        .set(updateData)
        .where(eq(profilesTable.id, user.id));
    } else {
      // Create new profile
      await db.insert(profilesTable).values({
        id: user.id,
        ...updateData,
        createdAt: new Date(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}
