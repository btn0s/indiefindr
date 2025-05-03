// Mark as a server component (no "use client" needed)
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { IndieGameListItem } from "@/components/IndieGameListItem";
// SubmitGameDialog is no longer directly needed here
// import { SubmitGameDialog } from "@/components/SubmitGameDialog";

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
    <div className="container max-w-5xl mx-auto px-4 py-8">
      {/* Hero Section - Left Aligned */}
      <section className="py-8 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl mb-3">
          Discover Your Next Favorite Indie Game
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          IndieFindr is your curated feed for discovering exciting new indie
          games. Explore the latest finds and uncover hidden gems.
        </p>
      </section>

      {/* Display List of Finds Container */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Recent Finds:</h2>
        {initialFinds.length > 0 ? (
          <ul className="space-y-3">
            {initialFinds.map((find) => (
              <li key={find.id}>
                <Link
                  href={`/finds/${find.id}`}
                  className="block hover:bg-gray-100 rounded-lg transition-colors duration-150 border border-transparent hover:border-gray-200"
                >
                  {/* Ensure find.reportData is passed and valid */}
                  {find.reportData && (
                    <IndieGameListItem reportData={find.reportData} />
                  )}
                </Link>
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
  );
}
