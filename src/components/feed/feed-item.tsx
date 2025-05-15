import React from "react";
import { ContentRenderer } from "@/components/content/content-renderer"; // Adjust path as needed
import type { FeedItem as ActualFeedItemType } from "@/services/feed-service"; // Import the new FeedItem type

interface FeedItemProps {
  item: ActualFeedItemType; // Use the specific FeedItem type from the service
  // We can add more props here later, e.g., interaction handlers, layout preferences
}

export const FeedItem: React.FC<FeedItemProps> = ({ item }) => {
  // The ContentRenderer will be updated to accept ActualFeedItemType directly
  // and handle its different subtypes (game_find, video_enrichment, etc.) internally.

  // For item.type === "game_find", ContentRenderer will know to access item.content.
  // For other enrichment types, ContentRenderer will use properties directly from item.

  return (
    <div className="feed-item-wrapper py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* 
        The crucial change will be updating ContentRenderer's props 
        and internal logic to understand the ActualFeedItemType structure.
        The `content` prop of ContentRenderer will need to accept ActualFeedItemType.
      */}
      <ContentRenderer content={item} variant="standard" />
    </div>
  );
};
