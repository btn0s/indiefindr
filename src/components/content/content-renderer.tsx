import React from "react";
import { GameCardViewModel } from "@/services/game-service";
import { GameCard } from "../game/game-card";
import type {
  FeedItem,
  GameContentFeedItem as ServiceGameContentFeedItem, // Alias to avoid conflict if we keep local types temporarily
  VideoEnrichmentFeedItem, // Import other types for later
  ArticleEnrichmentFeedItem,
  ImageEnrichmentFeedItem,
  AudioEnrichmentFeedItem,
  SnippetEnrichmentFeedItem,
  BaseFeedItem, // Import BaseFeedItem if you want to use it for FallbackContent more specifically
} from "@/services/feed-service";

// Define a more generic ContentItem type if needed, or specialize per type
// For now, we'll assume GameCardViewModel can represent a 'game' content item directly
// or we can define a more specific type if ContentRenderer handles more than just games.
// export interface ContentItemBase { ... }
// export type GameContentItem = ...;
// export interface VideoFeedItem ... (and other old local types)
// export type AnyContentItem = ...;

interface ContentRendererProps {
  content: FeedItem; // Uses FeedItem from service
  variant?: "compact" | "standard" | "detailed";
}

// GameContent component expects GameCardViewModel directly
const GameContent: React.FC<{
  gameData: GameCardViewModel;
  variant: ContentRendererProps["variant"];
}> = ({ gameData, variant }) => {
  // console.log("GameContent rendering gameData:", gameData, "variant:", variant);
  return <GameCard game={gameData} />;
};

// --- Placeholder Components for New Enriched Types ---
// These would be ideally refactored to accept the new EnrichmentFeedItem subtypes from the service.
// For now, we'll create stubs or map them if their props are very different.

const VideoEnrichmentDisplay: React.FC<{
  content: VideoEnrichmentFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #00ccff", padding: "10px", margin: "5px 0" }}
    >
      <h4>
        Video: {content.videoTitle || "Untitled Video"} (Game ID:{" "}
        {content.gameId})
      </h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.thumbnailUrl && (
        <img
          src={content.thumbnailUrl}
          alt={content.videoTitle || "Video thumbnail"}
          style={{ maxWidth: "200px", maxHeight: "150px" }}
        />
      )}
      {content.videoUrl && (
        <p>
          <a href={content.videoUrl} target="_blank" rel="noopener noreferrer">
            Watch Video
          </a>
        </p>
      )}
      {content.videoDescription && (
        <p>
          <small>Description: {content.videoDescription}</small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const ArticleEnrichmentDisplay: React.FC<{
  content: ArticleEnrichmentFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #ffcc00", padding: "10px", margin: "5px 0" }}
    >
      <h4>
        Article: {content.articleTitle || "Untitled Article"} (Game ID:{" "}
        {content.gameId})
      </h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.articleSnippet && <p>{content.articleSnippet}...</p>}
      {/* Assuming sourceName could be a link or provide enough info. Article URL is implicit or part of sourceName. */}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const ImageEnrichmentDisplay: React.FC<{
  content: ImageEnrichmentFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #00ff99", padding: "10px", margin: "5px 0" }}
    >
      <h4>Image (Game ID: {content.gameId})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.imageUrl && (
        <img
          src={content.imageUrl}
          alt={content.imageAltText || "Feed image"}
          style={{ maxWidth: "300px", maxHeight: "200px", display: "block" }}
        />
      )}
      {content.imageCaption && (
        <p>
          <small>{content.imageCaption}</small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const AudioEnrichmentDisplay: React.FC<{
  content: AudioEnrichmentFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #9966ff", padding: "10px", margin: "5px 0" }}
    >
      <h4>
        Audio: {content.audioTitle || "Untitled Audio"} (Game ID:{" "}
        {content.gameId})
      </h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.audioUrl && (
        <audio controls src={content.audioUrl}>
          Your browser does not support the audio element.
        </audio>
      )}
      {content.audioDescription && (
        <p>
          <small>{content.audioDescription}</small>
        </p>
      )}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const SnippetEnrichmentDisplay: React.FC<{
  content: SnippetEnrichmentFeedItem;
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px solid #ff6666", padding: "10px", margin: "5px 0" }}
    >
      <h4>Snippet (Game ID: {content.gameId})</h4>
      <p>
        <strong>Source:</strong> {content.sourceName || "N/A"}
      </p>
      {content.text && <p>"{content.text}"</p>}
      {variant && <small>Variant: {variant}</small>}
    </div>
  );
};

const FallbackContent: React.FC<{
  content: BaseFeedItem; // Changed to BaseFeedItem for more specific fallback
  variant: ContentRendererProps["variant"];
}> = ({ content, variant }) => {
  return (
    <div
      style={{ border: "1px dashed #ccc", padding: "10px", margin: "5px 0" }}
    >
      <p>
        Fallback: Content type "{content.type}" (Variant: {variant})
      </p>
      <p>
        <small>
          Game ID: {content.gameId}, Item Key: {content.feedItemKey}
        </small>
      </p>
    </div>
  );
};

export function ContentRenderer({
  content,
  variant = "standard",
}: ContentRendererProps) {
  // Add this console.log for debugging
  console.log(
    "ContentRenderer received content:",
    JSON.stringify(content, null, 2)
  );

  switch (content.type) {
    case "game_find":
      return <GameContent gameData={content.content} variant={variant} />;
    case "video_enrichment":
      return <VideoEnrichmentDisplay content={content} variant={variant} />;
    case "article_enrichment":
      return <ArticleEnrichmentDisplay content={content} variant={variant} />;
    case "image_enrichment":
      return <ImageEnrichmentDisplay content={content} variant={variant} />;
    case "audio_enrichment":
      return <AudioEnrichmentDisplay content={content} variant={variant} />;
    case "snippet_enrichment":
      return <SnippetEnrichmentDisplay content={content} variant={variant} />;

    // Old local type cases are removed.
    // default case will handle any FeedItem type not explicitly cased above.
    default:
      // This exhaustive check helps ensure all FeedItem types are handled.
      // If a new type is added to FeedItem union and not cased above, TypeScript will error here.
      const exhaustiveCheck: never = content;
      console.warn(
        "ContentRenderer: Unhandled FeedItem type -",
        (exhaustiveCheck as FeedItem).type
      );
      // Cast to BaseFeedItem for FallbackContent, as all FeedItems extend it.
      return (
        <FallbackContent content={content as BaseFeedItem} variant={variant} />
      );
  }
}
