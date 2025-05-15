"use client"; // This component uses hooks, so it's a client component

import React from "react";
import { useFeed, FeedType, FeedOptions } from "@/hooks/useFeed"; // Adjust path as needed
import { FeedItem } from "@/components/feed/feed-item";
import { GameCardViewModel } from "@/services/game-service";
import { GameContentItem } from "@/components/content/content-renderer";
import { Button } from "../ui/button";
import { Loader, Loader2 } from "lucide-react";
interface FeedContainerProps {
  feedType: FeedType;
  feedOptions?: FeedOptions;
  // Potentially add a header or title prop
  title?: string;
}

export const FeedContainer: React.FC<FeedContainerProps> = ({
  feedType,
  feedOptions,
  title,
}) => {
  const {
    items,
    isLoading,
    error,
    loadMore,
    hasMore,
    isLoadingInitialData,
    isEmpty,
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
      <div style={{ color: "red" }}>Error loading feed: {error.message}</div>
    );
  }

  if (isEmpty) {
    return <div>No items found for {title || feedType} feed.</div>;
  }

  return (
    <div className="feed-container max-w-lg mx-auto">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="feed-items-list flex flex-col gap-4 mb-8">
        {items.map((item) => {
          // The useFeed hook returns GameCardViewModel, adapt it to AnyContentItem for FeedItem
          // This assumes that for now, all feed items are 'game' type.
          // This will need to be more robust if useFeed returns mixed types.
          const gameContentItem: GameContentItem = {
            ...(item as GameCardViewModel), // Cast because useFeed returns GameCardViewModel
            type: "game", // Explicitly set the type for ContentRenderer
          };
          return <FeedItem key={item.id} item={gameContentItem} />;
        })}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={loadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading more..." : "Load More"}
        </Button>
      )}
      {!hasMore && items.length > 0 && (
        <p className="text-center text-muted-foreground">
          You've reached the end!
        </p>
      )}
    </div>
  );
};
