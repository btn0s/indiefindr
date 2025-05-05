"use server";

import { db, schema } from "@/db";
// Remove import of DetailedIndieGameReport
// Import RapidApiGameData type
import type { RapidApiGameData } from "@/lib/rapidapi/types";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
// import { redirect } from "next/navigation"; // Still not needed

// Updated type definition to include success status and potential new slug
export type RerunState = {
  message: string | null;
  success?: boolean;
  newSlug?: string;
};

// Removed original rerunAnalysisAction

// Action for the simple find endpoint (Steam URLs only)
export async function rerunSimpleAnalysisAction(
  prevState: RerunState,
  formData: FormData
): Promise<RerunState> {
  const sourceSteamUrl = formData.get("sourceSteamUrl") as string;
  const currentFindId = formData.get("currentFindId") as string; // Keep for logging

  if (!sourceSteamUrl) {
    return { message: "Source Steam URL is missing." };
  }

  if (!sourceSteamUrl.includes("store.steampowered.com/app/")) {
    return { message: "Invalid Steam URL provided." };
  }

  console.log(
    `[Action - Simple Rerun] Rerunning analysis for Steam URL: ${sourceSteamUrl}`
  );

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/find-simple`;

    console.log(`[Action - Simple Rerun] Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Match the expected structure for the simple endpoint
        messages: [{ role: "user", content: sourceSteamUrl }],
      }),
    });

    console.log(
      `[Action - Simple Rerun] API response status: ${response.status}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Action - Simple Rerun] API Error Response Text: ${errorText}`
      );
      const errorData = JSON.parse(errorText || "{}");
      throw new Error(
        errorData.error ||
          `HTTP error calling find-simple API! status: ${response.status}`
      );
    }

    // Expect the API to return { gameData: RapidApiGameData | null, findId: number }
    const result: { gameData: RapidApiGameData | null; findId: number } =
      await response.json();
    const updatedFindId = result.findId;
    const gameData = result.gameData; // Extract the game data object

    // Check if essential data for slug generation is present
    if (!updatedFindId || !gameData || !gameData.name) {
      console.error(
        "[Action - Simple Rerun] Invalid API response (missing ID, gameData, or game name):",
        result
      );
      throw new Error(
        "Analysis completed, but invalid data was returned from the simple API."
      );
    }

    console.log(
      `[Action - Simple Rerun] Successfully processed. New Find ID: ${updatedFindId}`
    );

    // Revalidate the path of the *old* page
    revalidatePath(`/finds/[slug]`, "page");
    console.log(`[Action - Simple Rerun] Path revalidated: /finds/[slug]`);

    // Generate slug from gameData.name
    const gameNameSlug =
      gameData.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
        .replace(/^-+|-+$/g, "") || "game"; // Trim leading/trailing hyphens

    const newSlug = `${gameNameSlug}-${updatedFindId}`;
    console.log(`[Action - Simple Rerun] Generated new slug: ${newSlug}`);

    // Return success state with the new slug
    return { message: null, success: true, newSlug: newSlug };
  } catch (err: any) {
    console.error("[Action - Simple Rerun] Error:", err);
    return {
      message:
        err.message || "Failed to rerun analysis using the simple endpoint.",
    };
  }
}
