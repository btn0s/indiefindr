import React from "react";
import { GameCardViewModel } from "@/services/game-service"; // Assuming GameCardViewModel is a good representation for a generic 'game' content item
import { GameCard } from "../game-card";

// Define a more generic ContentItem type if needed, or specialize per type
// For now, we'll assume GameCardViewModel can represent a 'game' content item directly
// or we can define a more specific type if ContentRenderer handles more than just games.
export interface ContentItemBase {
  id: string | number;
  type: "game" | "video" | "article" | "social" | "unknown";
  // other common fields
}

export type GameContentItem = GameCardViewModel & { type: "game" }; // Augmenting with type
// Define VideoContentItem, ArticleContentItem etc. as needed

export type AnyContentItem =
  | GameContentItem /* | VideoContentItem | ... */
  | (ContentItemBase & { type: "unknown" });

interface ContentRendererProps {
  content: AnyContentItem;
  variant?: "compact" | "standard" | "detailed";
}

// Mock simple components for different content types and variants
const GameContent: React.FC<{
  content: GameContentItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div>
      <GameCard game={content as GameContentItem} />
    </div>
  );
};

const FallbackContent: React.FC<{
  content: ContentItemBase;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px dashed #ccc", padding: "10px", margin: "5px 0" }}
    >
      <p>
        Unsupported content type: "{content.type}" (Variant: {variant})
      </p>
      <p>
        <small>ID: {content.id}</small>
      </p>
    </div>
  );
};

export function ContentRenderer({
  content,
  variant = "standard",
}: ContentRendererProps) {
  switch (content.type) {
    case "game":
      // Type assertion might be needed if AnyContentItem is a broader union
      return (
        <GameContent content={content as GameContentItem} variant={variant} />
      );
    // Add cases for 'video', 'article', 'social' when their specific components and types are defined
    // case 'video':
    //   return <VideoContent content={content as VideoContentItem} variant={variant} />;
    default:
      console.warn("ContentRenderer: Unknown content type -", content.type);
      return <FallbackContent content={content} variant={variant} />;
  }
}
