import { useState, useCallback, useEffect } from "react";
// Import FeedItem and FeedType from their respective service/hook locations
import type { FeedItem } from "@/lib/services/feed-service"; // Path to FeedItem type
// FeedType is now defined and exported from this file.
// Remove: import type { FeedType } from "./useFeed"; 

// Define and export FeedType from here
export type FeedType =
  | "personalized"
  | "recent"
  | "trending" // Example, if you plan to implement
  | "curated" // Example, if you plan to implement
  | "all"; // General public / fallback type

// Re-define FeedType here if it's not separately defined and exported for API use.
// For cleaner separation, FeedType could live in a shared types file.
// export type FeedType = "personalized" | "recent" | "trending" | "curated" | "all";

export interface FeedOptions {
  limit?: number;
}

// Updated to expect FeedItem[]
interface ApiFeedResponse {
  items: FeedItem[];
  page: number;
  pageSize: number;
  feedType: FeedType;
  hasMore: boolean;
  nextPage: number | null; // Added to match the API response structure
  totalItems?: number;
}

// Updated to store FeedItem[]
export interface FeedState {
  items: FeedItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  currentPage: number;
}

export function useFeed(feedType: FeedType, options: FeedOptions = {}) {
  const [feedState, setFeedState] = useState<FeedState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: true,
    currentPage: 0,
  });

  const loadFeedItems = useCallback(
    async (pageToLoad: number) => {
      console.log(
        `useFeed: Loading page ${pageToLoad} for type: ${feedType}`,
        options
      );
      setFeedState((prev: FeedState) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const limit = options.limit || 4; // Default page size, matching API
        // The API endpoint determines personalization based on userId (from auth context on server)
        // The 'type' parameter can still be used for other feed types like 'recent', 'trending' if implemented.
        let apiUrl = `/api/feed?type=${feedType}&page=${pageToLoad}&pageSize=${limit}`;

        // Example: if feedType was something specific that needs a query param beyond user context
        // if (feedType === "some_other_filter") {
        //   apiUrl += "&filter_param=value";
        // }

        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new Error(
            errorData.message ||
              `API request failed with status ${response.status}`
          );
        }

        const data: ApiFeedResponse = await response.json();

        setFeedState((prev: FeedState) => ({
          ...prev,
          isLoading: false,
          // If it's the first page load for this feedType, replace items.
          // Otherwise, append to existing items.
          items: pageToLoad === 1 ? data.items : [...prev.items, ...data.items],
          hasMore: data.hasMore,
          currentPage: pageToLoad, // data.page should reflect the pageToLoad
        }));
      } catch (err) {
        console.error("useFeed: Error loading feed items from API:", err);
        setFeedState((prev: FeedState) => ({
          ...prev,
          isLoading: false,
          error:
            err instanceof Error
              ? err
              : new Error("Failed to load feed from API"),
        }));
      }
    },
    [feedType, options]
  );

  useEffect(() => {
    setFeedState((prev: FeedState) => ({
      ...prev,
      items: [],
      currentPage: 0,
      hasMore: true,
      error: null,
    }));
    loadFeedItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType]); // `loadFeedItems` is memoized and includes `options` in its deps array.
  // Re-running only on feedType change for full reset and load page 1.
  // If options change and you want a reset, options should be in this dep array too.

  const loadMore = useCallback(() => {
    if (!feedState.isLoading && feedState.hasMore) {
      loadFeedItems(feedState.currentPage + 1);
    }
  }, [
    feedState.isLoading,
    feedState.hasMore,
    feedState.currentPage,
    loadFeedItems,
  ]);

  return {
    items: feedState.items,
    isLoading: feedState.isLoading,
    error: feedState.error,
    hasMore: feedState.hasMore,
    loadMore,
    isLoadingInitialData:
      feedState.isLoading &&
      feedState.currentPage === 0 &&
      feedState.items.length === 0,
    isLoadingMore:
      feedState.isLoading &&
      feedState.items.length > 0 &&
      feedState.currentPage > 0,
    isEmpty:
      !feedState.isLoading &&
      feedState.items.length === 0 &&
      !feedState.error &&
      feedState.currentPage > 0, // Consider if currentPage > 0 is the right condition for isEmpty
    isReachingEnd: !feedState.hasMore && !feedState.isLoading,
  };
}

// Re-export FeedType if it's defined here, or ensure it's imported by API route from a shared location.
// If FeedType is defined in this file as shown commented out earlier, export it.
// export type { FeedType }; 
