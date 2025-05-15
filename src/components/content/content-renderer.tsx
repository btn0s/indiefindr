import React from "react";
import { GameCardViewModel } from "@/services/game-service";
import { GameCard } from "@/components/game-card";
import { getGameUrl } from "@/utils/game-url";

export interface ContentItemBase {
  id: string | number;
  type: "game" | "video" | "article" | "social" | "unknown";
}

export type GameContentItem = GameCardViewModel & { type: "game" };
export type AnyContentItem =
  | GameContentItem
  | (ContentItemBase & { type: "unknown" });

interface ContentRendererProps {
  content: AnyContentItem;
  variant?: "compact" | "standard" | "detailed";
}

const GameContentComponent: React.FC<{
  content: GameContentItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  const detailsLinkHref = getGameUrl(content.id, content.title);

  return <GameCard game={content} detailsLinkHref={detailsLinkHref} />;
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
      return (
        <GameContentComponent
          content={content as GameContentItem}
          variant={variant}
        />
      );
    default:
      console.warn("ContentRenderer: Unknown content type -", content.type);
      return <FallbackContent content={content} variant={variant} />;
  }
}
