"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation"; // Import useSearchParams
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { useDebounce } from "use-debounce"; // Using a hook for debouncing
import { IndieGameListItem } from "@/components/IndieGameListItem"; // Import the component
import { DetailedIndieGameReport } from "@/schema"; // Import the report type

// Define the shape of the search result items from our API (updated)
interface SearchResult {
  id: string; // Assuming ID is UUID or number adjusted based on schema
  report: DetailedIndieGameReport;
  createdAt: string; // Assuming API returns date as string
  distance: number;
}

// Function to create SEO-friendly slugs (copied from src/app/page.tsx)
function createSlug(title: string, id: string | number): string {
  // Convert title to lowercase, replace spaces with hyphens, remove special chars
  const titleSlug =
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Remove consecutive hyphens
      .trim() || "untitled-game"; // Fallback if title is empty after processing

  // Combine with ID to ensure uniqueness
  return `${titleSlug}-${id}`;
}

export default function SearchPage() {
  const searchParams = useSearchParams(); // Get search params
  const initialQuery = searchParams.get("query") || ""; // Get initial query from URL
  const [query, setQuery] = useState(initialQuery); // Initialize state with URL query
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has been performed

  // Debounce the query state by 500ms
  const [debouncedQuery] = useDebounce(query, 500);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }
      const data: SearchResult[] = await response.json();
      // Ensure report is parsed if API returns it as string (unlikely with current API setup but good practice)
      const parsedResults = data.map((item) => ({
        ...item,
        report:
          typeof item.report === "string"
            ? JSON.parse(item.report)
            : item.report,
      }));
      setResults(parsedResults);
    } catch (err: any) {
      console.error("Search fetch error:", err);
      setError(err.message || "Failed to fetch search results.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effect to trigger search when debounced query changes
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Effect to handle initial load with query param (runs only once)
  // This is removed because initialization is now handled in useState
  // useEffect(() => {
  //   const initialQueryFromUrl = searchParams.get("query");
  //   if (initialQueryFromUrl) {
  //     // Set query state directly, which will trigger the debounced search
  //     setQuery(initialQueryFromUrl);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Search Finds</h1>
      <div className="flex gap-2 mb-6">
        <Input
          type="search"
          placeholder="Search for games, descriptions, genres..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow"
        />
        {/* Optional: Add a manual search button if debouncing isn't desired */}
        {/* <Button onClick={() => performSearch(query)} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Search
        </Button> */}
      </div>
      {/* --- Results Area --- */}
      <div className="flex flex-col gap-2">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Searching...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center justify-center py-6 text-red-600 bg-red-100 border border-red-300 rounded px-3 py-2">
            <AlertCircle className="mr-2 h-5 w-5" />
            <span>Error: {error}</span>
          </div>
        )}

        {/* Results Display */}
        {!isLoading && !error && hasSearched && (
          <div>
            {results.length > 0 ? (
              <>
                {/* Add results heading */}
                <h2 className="text-lg font-semibold mb-2">Search Results</h2>
                {/* Use ul styling from homepage */}
                <ul className="flex flex-col gap-2">
                  {results
                    .filter(
                      (result) =>
                        result.report && typeof result.report === "object"
                    )
                    .map((result) => (
                      <li key={result.id}>
                        <Link
                          href={`/finds/${createSlug(
                            result.report?.gameName || "untitled-game",
                            result.id
                          )}`}
                          className="block hover:bg-gray-100 rounded-lg transition-colors duration-150 border border-transparent hover:border-gray-200"
                        >
                          <IndieGameListItem
                            find={{
                              id: result.id,
                              reportData:
                                result.report as DetailedIndieGameReport,
                              createdAt: new Date(result.createdAt),
                            }}
                            showCreatedAt={false}
                          />
                        </Link>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                No results found for "{debouncedQuery}".
              </p>
            )}
          </div>
        )}

        {/* Initial State (before first search) */}
        {!isLoading && !error && !hasSearched && (
          <p className="text-center text-muted-foreground py-6">
            Enter a query above to search for finds.
          </p>
        )}
      </div>{" "}
      {/* End Results Area wrapper */}
    </div>
  );
}
