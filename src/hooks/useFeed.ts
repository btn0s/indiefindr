import { useState, useCallback, useEffect } from "react";
import { GameCardViewModel } from "@/services/game-service"; // Path to GameCardViewModel

// Define types for feed options and state
export type FeedType =
  | "personalized"
  | "recent"
  | "trending"
  | "curated"
  | "all"; // Added 'all' for a generic case

export interface FeedOptions {
  // Define any specific options for fetching feeds, e.g., filters, pagination
  limit?: number;
  // contentFilter?: ContentFilter; // From blueprint - define ContentFilter if needed
}

// Interface for the expected API response structure
interface ApiFeedResponse {
  items: GameCardViewModel[];
  page: number;
  pageSize: number;
  feedType: FeedType;
  hasMore: boolean;
  totalItems?: number; // Optional, but good for knowing total count
}

// Interface for the hook's internal state
export interface FeedState {
  items: GameCardViewModel[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  currentPage: number;
}

export function useFeed(feedType: FeedType, options: FeedOptions = {}) {
  const [feedState, setFeedState] = useState<FeedState>({
    items: [],
    isLoading: false,
    error: null,
    hasMore: true,
    currentPage: 0, // Start at 0, page 1 will be fetched initially
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
        const limit = options.limit || 10; // Default page size
        const response = await fetch(
          `/api/feed?type=${feedType}&page=${pageToLoad}&pageSize=${limit}`
        );

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
          items: pageToLoad === 1 ? data.items : [...prev.items, ...data.items],
          hasMore: data.hasMore,
          currentPage: pageToLoad,
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

  // Initial load or when feedType changes
  useEffect(() => {
    // Reset state before loading new feed type
    setFeedState((prev: FeedState) => ({
      ...prev,
      items: [],
      currentPage: 0,
      hasMore: true,
      error: null, // Clear previous errors
    }));
    loadFeedItems(1); // Load first page for the new feed type
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType]); // Only re-run if feedType changes. `loadFeedItems` is memoized.

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
    // SWR-like status indicators based on current state
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
      feedState.currentPage > 0,
    isReachingEnd: !feedState.hasMore && !feedState.isLoading,
  };
}
