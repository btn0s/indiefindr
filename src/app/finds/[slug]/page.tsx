import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import { DetailedIndieGameReport } from "@/schema";
import { RerunFormClient } from "@/components/RerunFormClient";

// Import the server action from the separate file
import { rerunAnalysisAction } from "./actions";

// Helper function to extract numeric ID from slug
function extractIdFromSlug(slug: string): number | null {
  const parts = slug.split("-");
  const idStr = parts[parts.length - 1];

  const id = parseInt(idStr, 10);
  return isNaN(id) ? null : id;
}

// Type for the data fetched by getFindById
interface FindPageData {
  id: number;
  sourceTweetUrl: string;
  reportData: DetailedIndieGameReport;
  createdAt: Date;
}

// This is now an async Server Component
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const findId = extractIdFromSlug(slug);

  if (findId === null) {
    console.error("Invalid ID format in slug:", slug);
    notFound(); // Use Next.js built-in notFound helper
  }

  // Fetch data directly on the server
  let initialFindData: FindPageData | null = null;
  try {
    const result = await db
      .select({
        id: schema.finds.id,
        reportData: schema.finds.report,
        createdAt: schema.finds.createdAt,
        sourceTweetUrl: schema.finds.sourceTweetUrl,
      })
      .from(schema.finds)
      .where(eq(schema.finds.id, findId))
      .limit(1);

    if (result.length === 0) {
      notFound(); // Not found
    }

    const find = result[0];
    let reportData: DetailedIndieGameReport | null = null;

    // Parse the reportData JSON
    if (find.reportData) {
      if (typeof find.reportData === "string") {
        try {
          reportData = JSON.parse(find.reportData);
        } catch (e) {
          console.error(`Failed to parse reportData for find ${find.id}:`, e);
          // If parsing fails, treat as not found or show error?
          // For now, let's treat it as critical and call notFound
          notFound();
        }
      } else {
        reportData = find.reportData as DetailedIndieGameReport;
      }
    }

    if (!reportData) {
      console.error(`Report data is null or invalid for find ${find.id}`);
      notFound(); // Treat missing report data as not found
    }

    initialFindData = {
      id: find.id,
      reportData: reportData,
      createdAt: find.createdAt,
      sourceTweetUrl: find.sourceTweetUrl,
    };
  } catch (error) {
    console.error(`Error fetching find with ID ${findId}:`, error);
    // Consider showing a generic error page instead of notFound for DB errors
    notFound(); // Or throw error to trigger error.tsx
  }

  // We ensured findData is not null by calling notFound() otherwise
  // Pass the initial data and the *imported* server action to the client component
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-5xl">
        {/* Minimal client component for the form/button */}
        <RerunFormClient
          findId={initialFindData.id}
          sourceTweetUrl={initialFindData.sourceTweetUrl}
          rerunAnalysisAction={rerunAnalysisAction}
        />
        {/* Render the report directly in the server component */}
        <IndieGameReport reportData={initialFindData.reportData} />
      </div>
    </div>
  );
}
