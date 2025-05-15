import React from "react";
// Path to content-renderer will need to be updated after it's renamed
import {
  AnyContentItem,
  ContentRenderer,
} from "@/components/content/content-renderer";

interface FeedItemProps {
  item: AnyContentItem;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item }) => {
  return (
    <div className="feed-item-wrapper" style={{ marginBottom: "1rem" }}>
      {/* Ensure variant="standard" or similar is passed if ContentRenderer expects it */}
      <ContentRenderer content={item} variant="standard" />
    </div>
  );
};
