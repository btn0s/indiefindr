"use server";

import { db, schema } from "@/db";
import type { DetailedIndieGameReport } from "@/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
// import { redirect } from "next/navigation"; // No longer needed for redirect

// Updated type definition to include success status and potential new slug
export type RerunState = {
  message: string | null;
  success?: boolean;
  newSlug?: string;
};

// Removed rerunAnalysisAction as it handled Twitter URLs which are no longer supported for rerun

// Action for the simple find endpoint (Steam URLs only)
export async function rerunSimpleAnalysisAction(
  prevState: RerunState,
  formData: FormData
): Promise<RerunState> {
  // Return type remains RerunState, but we'll populate new fields
  const sourceSteamUrl = formData.get("sourceSteamUrl") as string;
  const currentFindId = formData.get("currentFindId") as string; // Keep for potential future use or logging

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

    // The simple endpoint returns { report: ..., findId: ... }
    const result = await response.json();
    const updatedFindId = result.findId;
    const report = result.report as Partial<DetailedIndieGameReport>; // Cast to partial as it's not the full AI report

    if (!updatedFindId || !report) {
      console.error("[Action - Simple Rerun] Invalid API response:", result);
      throw new Error(
        "Analysis completed, but invalid data (ID or report) was returned from the simple API."
      );
    }

    console.log(
      `[Action - Simple Rerun] Successfully processed. New Find ID: ${updatedFindId}`
    );

    // Revalidate the path of the *old* page
    revalidatePath(`/finds/[slug]`, "page");
    console.log(`[Action - Simple Rerun] Path revalidated: /finds/[slug]`);

    // Generate slug from the returned report
    let gameNameSlug = "game";
    if (report.gameName) {
      gameNameSlug =
        report.gameName
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "game";
    }

    const newSlug = `${gameNameSlug}-${updatedFindId}`;
    console.log(`[Action - Simple Rerun] Generated new slug: ${newSlug}`);

    // Redirect to the new find page - REMOVED
    // redirect(`/finds/${newSlug}`);

    // Return success state with the new slug
    return { message: null, success: true, newSlug: newSlug };

    // Note: redirect() throws an error, so code below won't execute
  } catch (err: any) {
    console.error("[Action - Simple Rerun] Error:", err);
    return {
      message:
        err.message || "Failed to rerun analysis using the simple endpoint.",
    };
  }
}
