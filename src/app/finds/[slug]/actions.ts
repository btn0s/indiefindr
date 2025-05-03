"use server";

import { db, schema } from "@/db";
import type { DetailedIndieGameReport } from "@/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Type definition for the state/return value
export type RerunState = { message: string | null };

export async function rerunAnalysisAction(
  prevState: RerunState,
  formData: FormData
): Promise<RerunState> {
  const sourceTweetUrl = formData.get("sourceTweetUrl") as string;
  const currentFindId = formData.get("currentFindId") as string;

  if (!sourceTweetUrl) {
    return { message: "Source Tweet URL is missing." };
  }

  try {
    // Call the existing API route that performs the analysis
    // Use environment variables securely on the server
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/find`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: sourceTweetUrl }],
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error occurred" }));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const result = await response.json();
    const updatedFindId = result.findId;

    if (!updatedFindId) {
      throw new Error("Analysis completed, but no new Find ID was returned.");
    }

    // Revalidate the path of the *old* page in case user navigates back
    // Using 'page' ensures it targets the page component cache
    revalidatePath(`/finds/[slug]`, "page");

    // Fetch the new report briefly to get the game name for the slug
    const newFindResult = await db
      .select({ reportData: schema.finds.report })
      .from(schema.finds)
      .where(eq(schema.finds.id, updatedFindId))
      .limit(1);

    let gameNameSlug = "game";
    if (newFindResult.length > 0 && newFindResult[0].reportData) {
      try {
        const report = (
          typeof newFindResult[0].reportData === "string"
            ? JSON.parse(newFindResult[0].reportData)
            : newFindResult[0].reportData
        ) as DetailedIndieGameReport;
        gameNameSlug =
          report.gameName
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "game";
      } catch (e) {
        console.error(
          "Failed to parse new report data for slug generation:",
          e
        );
        // Fallback if parsing fails
        gameNameSlug = "game";
      }
    }

    const newSlug = `${gameNameSlug}-${updatedFindId}`;

    // Redirect to the new find page
    redirect(`/finds/${newSlug}`);

    // Note: redirect() throws an error, so code below won't execute
  } catch (err: any) {
    console.error("Error in rerunAnalysisAction:", err);
    return { message: err.message || "Failed to rerun analysis." }; // Return error message
  }
}
