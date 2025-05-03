import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { IndieGameReport } from "@/components/IndieGameReport";
import { DetailedIndieGameReport } from "@/schema"; // Ensure this type is correct

// Revalidate data every hour, or set to 0 for dynamic on every request
export const revalidate = 3600;

interface FindPageProps {
  params: {
    slug: string; // The 'slug' from the URL now contains gameName-id format
  };
}

// Helper function to extract numeric ID from slug
function extractIdFromSlug(slug: string): number | null {
  // Extract the ID from the last part of the slug after the last hyphen
  const parts = slug.split("-");
  const idStr = parts[parts.length - 1];

  const id = parseInt(idStr, 10);
  return isNaN(id) ? null : id;
}

async function getFindById(slug: string) {
  // Extract numeric ID from the slug (e.g., "game-title-123" -> 123)
  const findId = extractIdFromSlug(slug);

  if (findId === null) {
    console.error("Invalid ID format in slug:", slug);
    return null;
  }

  try {
    const result = await db
      .select({
        id: schema.finds.id,
        reportData: schema.finds.report, // Select the 'report' column
        createdAt: schema.finds.createdAt,
      })
      .from(schema.finds)
      .where(eq(schema.finds.id, findId))
      .limit(1);

    if (result.length === 0) {
      return null; // Not found
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
          // Keep reportData as null if parsing fails
        }
      } else {
        // Assume it's already JSON
        reportData = find.reportData as DetailedIndieGameReport;
      }
    }

    if (!reportData) {
      console.error(`Report data is null or invalid for find ${find.id}`);
      return null; // Treat as not found if report data is invalid
    }

    // Return only the necessary report data
    return reportData;
  } catch (error) {
    console.error(`Error fetching find with ID ${findId}:`, error);
    return null; // Return null on error
  }
}

// This is the Server Component for the dynamic route
export default async function FindPage({ params }: FindPageProps) {
  const { slug } = params;
  const reportData = await getFindById(slug);

  if (!reportData) {
    notFound(); // Use Next.js built-in notFound helper
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gray-50">
      {/* Maybe add a back button later */}
      <div className="w-full max-w-5xl">
        {/* Render the detailed report component */}
        <IndieGameReport reportData={reportData} />
      </div>
    </div>
  );
}
