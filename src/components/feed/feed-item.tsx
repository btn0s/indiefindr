import React from "react";
import {
  AnyContentItem,
  ContentRenderer,
} from "@/components/content/content-renderer"; // Adjust path as needed

interface FeedItemProps {
  item: AnyContentItem;
  // We can add more props here later, e.g., interaction handlers, layout preferences
}

export const FeedItem: React.FC<FeedItemProps> = ({ item }) => {
  // The FeedItem itself might have some wrapper styling or logic common to all feed items
  return (
    <div className="feed-item-wrapper">
      <ContentRenderer content={item} variant="standard" />
      {/* 
        Potentially add common actions here like save, share, etc.,
        or pass interaction handlers down to ContentRenderer/specific content components.
      */}
    </div>
  );
};
