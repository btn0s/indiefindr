import React from "react";
import { GameCardViewModel } from "@/services/game-service"; // Assuming GameCardViewModel is a good representation for a generic 'game' content item
import { GameCard } from "../game/game-card";

// Define a more generic ContentItem type if needed, or specialize per type
// For now, we'll assume GameCardViewModel can represent a 'game' content item directly
// or we can define a more specific type if ContentRenderer handles more than just games.
export interface ContentItemBase {
  id: string | number; // For enriched items, this will be the enrichment ID
  type:
    | "game"
    | "video"
    | "article"
    | "social"
    | "image"
    | "review" // For review snippets or short-form text content
    | "unknown";
  // Common fields for items derived from enrichments
  gameId?: number; // ID of the game this enrichment is associated with (if applicable)
  sourceName?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string | null; // Or Date, for sorting/display
}

export type GameContentItem = GameCardViewModel &
  Pick<ContentItemBase, "type" | "id" | "retrievedAt"> & {
    // type is overridden to "game"
    // id is from GameCardViewModel
    // retrievedAt is added by the service for sorting
    type: "game";
  };

// --- Specific Feed Item Types (extending ContentItemBase) ---
export interface VideoFeedItem extends ContentItemBase {
  type: "video";
  videoUrl: string;
  title?: string | null;
  thumbnailUrl?: string | null;
}

export interface ImageFeedItem extends ContentItemBase {
  type: "image";
  imageUrl: string;
  altText?: string | null;
}

export interface ArticleFeedItem extends ContentItemBase {
  type: "article";
  articleUrl: string;
  title?: string | null;
  snippet?: string | null;
  thumbnailUrl?: string | null;
}

export interface ReviewFeedItem extends ContentItemBase {
  type: "review";
  reviewSnippet: string;
  // author?: string | null;
  // rating?: number | null;
}

export interface SocialFeedItem extends ContentItemBase {
  type: "social";
  postUrl: string;
  text?: string | null;
  author?: string | null;
  mediaUrls?: { type: "image" | "video"; url: string }[];
}
// --- End Specific Feed Item Types ---

export type AnyContentItem =
  | GameContentItem
  | VideoFeedItem
  | ImageFeedItem
  | ArticleFeedItem
  | ReviewFeedItem
  | SocialFeedItem
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

// --- Placeholder Components for New Enriched Types ---
const VideoContent: React.FC<{
  content: VideoFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #00ccff", padding: "10px", margin: "5px 0" }}
    >
      <h4>Video (Game ID: {content.gameId || "N/A"})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.title && <p>Title: {content.title}</p>}
      {content.thumbnailUrl && (
        <img
          src={content.thumbnailUrl}
          alt={content.title || "Video thumbnail"}
          style={{ maxWidth: "200px", maxHeight: "150px" }}
        />
      )}
      <p>
        <a href={content.videoUrl} target="_blank" rel="noopener noreferrer">
          Watch Video
        </a>
      </p>
      {content.sourceUrl && (
        <p>
          <small>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          </small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const ImageContent: React.FC<{
  content: ImageFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #00ff99", padding: "10px", margin: "5px 0" }}
    >
      <h4>Image (Game ID: {content.gameId || "N/A"})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      <img
        src={content.imageUrl}
        alt={content.altText || "Feed image"}
        style={{ maxWidth: "300px", maxHeight: "200px", display: "block" }}
      />
      {content.sourceUrl && (
        <p>
          <small>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          </small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const ArticleContent: React.FC<{
  content: ArticleFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #ffcc00", padding: "10px", margin: "5px 0" }}
    >
      <h4>Article (Game ID: {content.gameId || "N/A"})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.title && <h5>{content.title}</h5>}
      {content.thumbnailUrl && (
        <img
          src={content.thumbnailUrl}
          alt={content.title || "Article thumbnail"}
          style={{
            maxWidth: "150px",
            maxHeight: "100px",
            float: "left",
            marginRight: "10px",
          }}
        />
      )}
      {content.snippet && <p>{content.snippet}...</p>}
      <p>
        <a href={content.articleUrl} target="_blank" rel="noopener noreferrer">
          Read Article
        </a>
      </p>
      {content.sourceUrl && (
        <p style={{ clear: "both" }}>
          <small>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          </small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const ReviewContent: React.FC<{
  content: ReviewFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #ff6666", padding: "10px", margin: "5px 0" }}
    >
      <h4>Review Snippet (Game ID: {content.gameId || "N/A"})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      <p>"{content.reviewSnippet}"</p>
      {content.sourceUrl && (
        <p>
          <small>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read Full Review
            </a>
          </small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const SocialContent: React.FC<{
  content: SocialFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #9966ff", padding: "10px", margin: "5px 0" }}
    >
      <h4>Social Post (Game ID: {content.gameId || "N/A"})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}{" "}
        {content.author && `by ${content.author}`}
      </p>
      {content.text && <p>{content.text}</p>}
      {content.mediaUrls?.map((media, index) => (
        <div key={index} style={{ marginTop: "5px" }}>
          {media.type === "image" && (
            <img
              src={media.url}
              alt={`Social media image ${index + 1}`}
              style={{ maxWidth: "250px", maxHeight: "150px" }}
            />
          )}
          {media.type === "video" && (
            <video
              src={media.url}
              controls
              style={{ maxWidth: "250px", maxHeight: "150px" }}
            />
          )}
        </div>
      ))}
      <p>
        <a href={content.postUrl} target="_blank" rel="noopener noreferrer">
          View Post
        </a>
      </p>
      {content.sourceUrl && content.sourceUrl !== content.postUrl && (
        <p>
          <small>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Original Source
            </a>
          </small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};
// --- End Placeholder Components ---

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
        <GameContent content={content as GameContentItem} variant={variant} />
      );
    case "video":
      return (
        <VideoContent content={content as VideoFeedItem} variant={variant} />
      );
    case "image":
      return (
        <ImageContent content={content as ImageFeedItem} variant={variant} />
      );
    case "article":
      return (
        <ArticleContent
          content={content as ArticleFeedItem}
          variant={variant}
        />
      );
    case "review":
      return (
        <ReviewContent content={content as ReviewFeedItem} variant={variant} />
      );
    case "social":
      return (
        <SocialContent content={content as SocialFeedItem} variant={variant} />
      );
    default:
      console.warn("ContentRenderer: Unknown content type -", content.type);
      return <FallbackContent content={content} variant={variant} />;
  }
}
