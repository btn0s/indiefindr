"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { generateRandomUsername } from "@/lib/utils/username";

export async function getProfileByUsername(username: string) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getProfileByUserId(userId: string) {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getCurrentUserProfile() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getProfileByUserId(user.id);
}

export async function setUsername(userId: string, username: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await getSupabaseServerClient();
  const serviceClient = getSupabaseServiceClient();

  const normalizedUsername = username.toLowerCase().trim();

  if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
    return { error: "Username must be between 3 and 20 characters" };
  }

  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    return { error: "Username can only contain letters, numbers, and underscores" };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existing && existing.id !== userId) {
    return { error: "Username is already taken" };
  }

  const { error, data } = await serviceClient
    .from("profiles")
    .update({ username: normalizedUsername })
    .eq("id", userId)
    .select();

  if (error) {
    if (error.code === "23505") {
      return { error: "Username is already taken" };
    }
    if (error.code === "23514") {
      return { error: "Username format is invalid" };
    }
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Profile not found" };
  }

  revalidatePath("/settings");
  revalidatePath("/saved");
  return { success: true };
}

export async function getUsernameByUserId(userId: string): Promise<string | null> {
  const profile = await getProfileByUserId(userId);
  return profile?.username ?? null;
}

export async function updateDisplayName(
  userId: string,
  displayName: string | null
): Promise<{ error?: string; success?: boolean }> {
  const serviceClient = getSupabaseServiceClient();

  const { error, data } = await serviceClient
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId)
    .select();

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Profile not found" };
  }

  revalidatePath("/settings");
  revalidatePath("/saved");
  return { success: true };
}

/**
 * Generate and set a random username for a user
 * Retries up to 5 times if the generated username is already taken
 */
export async function generateAndSetRandomUsername(
  userId: string
): Promise<{ error?: string; username?: string; success?: boolean }> {
  const supabase = await getSupabaseServerClient();
  const serviceClient = getSupabaseServiceClient();

  // Try up to 5 times to find an available username
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomUsername = generateRandomUsername().toLowerCase();

    // Check if username is already taken
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", randomUsername)
      .maybeSingle();

    if (existing && existing.id !== userId) {
      // Username is taken, try again
      continue;
    }

    // Username is available, set it
    const { error, data } = await serviceClient
      .from("profiles")
      .update({ username: randomUsername })
      .eq("id", userId)
      .select();

    if (error) {
      if (error.code === "23505") {
        // Username was taken between check and update, try again
        continue;
      }
      if (error.code === "23514") {
        return { error: "Generated username format is invalid" };
      }
      return { error: error.message };
    }

    if (!data || data.length === 0) {
      return { error: "Profile not found" };
    }

    revalidatePath("/settings");
    revalidatePath("/saved");
    return { success: true, username: randomUsername };
  }

  // All attempts failed
  return { error: "Unable to generate an available username. Please try again." };
}
