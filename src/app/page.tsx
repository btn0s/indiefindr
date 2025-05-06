// Mark as a server component (no "use client" needed)

import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { IndieGameListItem } from "@/components/IndieGameListItem";
// Client-side hooks removed
// import { useRouter } from "next/navigation"; // Import router
// import { Input } from "@/components/ui/input"; // Assuming shadcn/ui Input
// import { Button } from "@/components/ui/button"; // Assuming shadcn/ui Button
import { HeroSearchForm } from "@/components/HeroSearchForm"; // Import the new client component
import { type RapidApiReview } from "@/lib/rapidapi/types"; // Import review type

// Revalidate data every 60 seconds (or choose your preferred interval)
// Or set to 0 for dynamic rendering on every request
export const revalidate = 0; // Re-enable revalidation or keep as 0 for dynamic

// Function to create SEO-friendly slugs
function createSlug(title: string, id: string | number): string {
  // Convert title to lowercase, replace spaces with hyphens, remove special chars
  const titleSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove consecutive hyphens
    .trim(); // Trim leading/trailing spaces

  // Combine with ID to ensure uniqueness
  return `${titleSlug}-${id}`;
}

async function getRecentFinds() {
  try {
    const finds = await db
      .select({
        id: schema.finds.id,
        reportData: schema.finds.report,
        createdAt: schema.finds.createdAt,
        rawSteamJson: schema.finds.rawSteamJson,
        rawReviewJson: schema.finds.rawReviewJson, // Select reviews
      })
      .from(schema.finds)
      .orderBy(desc(schema.finds.createdAt))
      .limit(20);

    const parsedFinds = finds
      .map((find) => {
        // Parse reportData
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
            }
          } else {
            reportData = find.reportData;
          }
        }

        // Parse rawSteamJson (gameData)
        let gameData = null;
        if (find.rawSteamJson) {
          if (
            typeof find.rawSteamJson === "object" &&
            find.rawSteamJson !== null
          ) {
            gameData = find.rawSteamJson;
          } else if (typeof find.rawSteamJson === "string") {
            try {
              gameData = JSON.parse(find.rawSteamJson);
            } catch (e) {
              console.error(
                `Failed to parse rawSteamJson for find ${find.id}:`,
                e
              );
            }
          }
        }

        // Parse rawReviewJson
        let reviewData: RapidApiReview[] | null = null;
        if (find.rawReviewJson) {
          if (Array.isArray(find.rawReviewJson)) {
            reviewData = find.rawReviewJson as RapidApiReview[];
          } else if (typeof find.rawReviewJson === "string") {
            try {
              reviewData = JSON.parse(find.rawReviewJson) as RapidApiReview[];
              if (!Array.isArray(reviewData)) {
                console.warn(
                  `Parsed rawReviewJson is not an array for find ${find.id} on homepage`
                );
                reviewData = null;
              }
            } catch (e) {
              console.error(
                `Failed to parse rawReviewJson for find ${find.id} on homepage:`,
                e
              );
              reviewData = null;
            }
          } else {
            console.warn(
              `rawReviewJson is not an array or string for find ${find.id} on homepage`
            );
          }
        }

        return {
          ...find,
          reportData: reportData as any,
          gameData: gameData, // Include parsed gameData
          rawReviewJson: reviewData, // Include parsed reviewData
        };
      })
      .filter((find) => find.reportData !== null); // Keep existing filter

    return parsedFinds;
  } catch (error) {
    console.error("Error fetching finds:", error);
    return [];
  }
}

// Define the type for the props expected by the Home component
// Since getRecentFinds is async, the component receives the result as props
// interface HomeProps {
//   initialFinds: Awaited<ReturnType<typeof getRecentFinds>>;
// }
// Removed HomeProps interface as it's not strictly needed for a default export Server Component fetching its own data

// The default export is now an async Server Component again
export default async function Home() {
  const initialFinds = await getRecentFinds(); // Fetch data directly
  // State and effects removed

  // handleSearchSubmit removed

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      {/* Hero Section - Left Aligned */}
      <section className="py-8 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl mb-3">
          Discover Your Next Favorite Indie Game
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground mb-6">
          IndieFindr is your curated feed for discovering exciting new indie
          games. Explore the latest finds and uncover hidden gems.
        </p>
        {/* Use the client component for the search form */}
        <HeroSearchForm />
      </section>

      {/* Display List of Finds Container */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recent Finds</h2>
        {initialFinds.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {initialFinds.map((find) => (
              <li key={find.id}>
                <Link
                  href={`/finds/${createSlug(
                    find.reportData?.gameName || "untitled-game",
                    find.id
                  )}`}
                  className="block hover:bg-gray-100 rounded-lg transition-colors duration-150 border border-transparent hover:border-gray-200"
                >
                  {/* Updated to pass the complete find object */}
                  {find.reportData && (
                    <IndieGameListItem find={find} showCreatedAt={true} />
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
