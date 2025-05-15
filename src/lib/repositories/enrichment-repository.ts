import { InferSelectModel } from "drizzle-orm";
import { gameEnrichmentTable } from "@/db/schema";

export type GameEnrichment = InferSelectModel<typeof gameEnrichmentTable>;

export interface EnrichedMedia {
  type: "video" | "image" | "screeenshot";
  url: string;
  thumbnailUrl?: string;
  provider?: string; // e.g., YouTube, Steam
}

export interface SocialMention {
  platform: "twitter" | "reddit" | "forum";
  url: string;
  snippet?: string;
  sentiment?: number; // e.g., -1 to 1
}

export const EnrichmentRepository = {
  async getMediaForGame(gameId: string): Promise<EnrichedMedia[]> {
    console.log(`Mock: Fetching media for gameId: ${gameId}`);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Return mock data
    return [
      {
        type: "video",
        url: "https://example.com/video1.mp4",
        thumbnailUrl: "https://example.com/thumb1.jpg",
        provider: "YouTube",
      },
      {
        type: "image",
        url: "https://example.com/image1.jpg",
        provider: "Steam",
      },
    ];
  },

  async getSocialMentionsForGame(gameId: string): Promise<SocialMention[]> {
    console.log(`Mock: Fetching social mentions for gameId: ${gameId}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return [
      {
        platform: "twitter",
        url: "https://twitter.com/example/status/123",
        snippet: "This game is great!",
      },
      {
        platform: "reddit",
        url: "https://reddit.com/r/games/comments/abc",
        snippet: "Looking forward to the release.",
      },
    ];
  },

  async getCommunityContentForGame(gameId: string): Promise<any[]> {
    console.log(`Mock: Fetching community content for gameId: ${gameId}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return []; // Empty for now
  },
  // Future methods for different enrichment sources
};
