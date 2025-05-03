// Mark as a server component (no "use client" needed)
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { IndieGameListItem } from "@/components/IndieGameListItem";
import { SubmitGameDialog } from "@/components/SubmitGameDialog";

// Revalidate data every 60 seconds (or choose your preferred interval)
// Or set to 0 for dynamic rendering on every request
export const revalidate = 0; // Example: Dynamic rendering

async function getRecentFinds() {
  try {
    const finds = await db
      .select({
        id: schema.finds.id,
        reportData: schema.finds.report,
        createdAt: schema.finds.createdAt,
      })
      .from(schema.finds)
      .orderBy(desc(schema.finds.createdAt))
      .limit(20); // Example limit

    // Drizzle returns reportData as potentially string | null | Json,
    // we need to ensure it's parsed if stored as a string.
    // Also handle potential nulls gracefully.
    const parsedFinds = finds
      .map((find) => {
        let reportData = null;
        if (find.reportData) {
          if (typeof find.reportData === "string") {
            try {
              reportData = JSON.parse(find.reportData);
            } catch (e) {
              console.error(
                `Failed to parse reportData for find ${find.id}:`,
                e
              );
              // Keep reportData as null if parsing fails
            }
          } else {
            // Assume it's already JSON
            reportData = find.reportData;
          }
        }
        return {
          ...find,
          // Ensure reportData is always in the expected object format or null
          reportData: reportData as any, // Cast needed if DetailedIndieGameReport type isn't perfectly aligned
        };
      })
      .filter((find) => find.reportData !== null); // Filter out finds with null/invalid reportData

    return parsedFinds;
  } catch (error) {
    console.error("Error fetching finds:", error);
    return []; // Return empty array on error
  }
}

export default async function Home() {
  const initialFinds = await getRecentFinds();

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl space-y-6">
        {/* Header Row */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">IndieFindr</h1>
          {/* SubmitGameDialog is a Client Component, can be used directly */}
          <SubmitGameDialog />
        </div>

        {/* Display List of Finds */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Recent Finds:</h2>
          {initialFinds.length > 0 ? (
            <ul className="space-y-3">
              {initialFinds.map((find) => (
                <li key={find.id}>
                  {/* Wrap list item in a Link later for navigation */}
                  {/* Ensure find.reportData is passed and valid */}
                  {find.reportData && (
                    <IndieGameListItem reportData={find.reportData} />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No finds submitted yet. Use the button above to add one!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
