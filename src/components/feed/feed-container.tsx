"use client"; // This component uses hooks, so it's a client component

import React from "react";
import { useFeed, FeedType, FeedOptions } from "@/hooks/useFeed"; // Adjust path as needed
import { FeedItem as FeedItemComponent } from "@/components/feed/feed-item";
import type { FeedItem as FeedItemType } from "@/services/feed-service"; // Import the type for items array
// Remove unused import for GameContentItem as it was deleted from content-renderer
// import { GameContentItem } from "@/components/content/content-renderer";
// GameCardViewModel might also be unused here now if items are directly FeedItemType
// import { GameCardViewModel } from "@/services/game-service";
import { Button } from "../ui/button";
import { Loader, Loader2 } from "lucide-react";

interface FeedContainerProps {
  feedType: FeedType;
  feedOptions?: FeedOptions;
  // Potentially add a header or title prop
  title?: string;
  showLoadMoreButton?: boolean;
  emptyStateMessage?: string;
  className?: string;
  itemClassName?: string; // Optional: For styling individual items if needed
  // onContentClick?: (content: AnyContentItem) => void; // Revisit if needed, AnyContentItem is removed
}

export const FeedContainer: React.FC<FeedContainerProps> = ({
  feedType,
  feedOptions = {},
  title,
  emptyStateMessage = "No items to display.",
}) => {
  const {
    items,
    loadMore,
    isLoading,
    hasMore,
    error,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
  } = useFeed(feedType, feedOptions);

  if (isLoadingInitialData) {
    return (
      <div className="feed-container max-w-lg mx-auto">
        {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
        <div className="flex justify-center items-center h-full pt-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 text-red-600 bg-red-100 border border-red-400 rounded-md`}
      >
        <p>Error loading feed: {error.message}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`p-4 text-center text-gray-500 dark:text-gray-400`}>
        <p>{emptyStateMessage}</p>
      </div>
    );
  }

  return (
    <div className={`feed-container max-w-lg mx-auto`}>
      {title && (
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">
          {title}
        </h2>
      )}

      {isLoadingInitialData && (
        <div className="flex justify-center items-center p-8">
          {/* Replace with a more sophisticated loading skeleton or spinner component */}
          <p className="text-gray-500 dark:text-gray-400">Loading feed...</p>
        </div>
      )}

      {!isLoadingInitialData && isEmpty && (
        <div className={`p-4 text-center text-gray-500 dark:text-gray-400`}>
          <p>{emptyStateMessage}</p>
        </div>
      )}

      {!isEmpty && (
        <div className="feed-items-list flex flex-col">
          {items.map((item: FeedItemType) => (
            <div key={item.feedItemKey}>
              {/* Apply itemClassName here if provided */}
              <FeedItemComponent item={item} />
            </div>
          ))}
        </div>
      )}

      {isLoadingMore && (
        <div className="flex justify-center items-center p-4">
          <p className="text-gray-500 dark:text-gray-400">
            Loading more items...
          </p>
        </div>
      )}

      {hasMore && !isLoading && !isLoadingInitialData && (
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="w-full"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {isReachingEnd && !isLoading && !isEmpty && (
        <div className="mt-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            You've reached the end!
          </p>
        </div>
      )}
    </div>
  );
};
