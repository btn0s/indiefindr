import { InferSelectModel, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db"; // Assuming db instance is exported from @/db
import { gameEnrichmentTable } from "@/lib/db/schema";

// This is the Drizzle schema type for a row in gameEnrichmentTable
export type GameEnrichment = InferSelectModel<typeof gameEnrichmentTable>;

// Interface for the repository (optional, but good practice)
export interface IEnrichmentRepository {
  getEnrichmentsForGameIds(gameIds: number[]): Promise<GameEnrichment[]>;
  // Add other methods as needed, e.g.:
  // addEnrichment(enrichmentData: Omit<GameEnrichment, 'id' | 'createdAt' | 'updatedAt'>): Promise<GameEnrichment>;
}

export class DrizzleEnrichmentRepository implements IEnrichmentRepository {
  async getEnrichmentsForGameIds(gameIds: number[]): Promise<GameEnrichment[]> {
    if (!gameIds || gameIds.length === 0) {
      return [];
    }
    console.log(
      `DrizzleEnrichmentRepository: Fetching enrichments for gameIds: ${gameIds.join(", ")}`
    );
    try {
      const enrichments = await db
        .select()
        .from(gameEnrichmentTable)
        .where(inArray(gameEnrichmentTable.gameId, gameIds))
        .orderBy(desc(gameEnrichmentTable.createdAt)); // Order by creation date, newest first

      console.log(
        `DrizzleEnrichmentRepository: Found ${enrichments.length} enrichments.`
      );
      return enrichments;
    } catch (error) {
      console.error(
        "DrizzleEnrichmentRepository: Error fetching enrichments by game IDs:",
        error
      );
      throw new Error("Failed to fetch enrichments from database."); // Or return [] depending on error handling strategy
    }
  }

  // Placeholder for adding a new enrichment (example)
  /*
  async addEnrichment(enrichmentData: Omit<GameEnrichment, 'id' | 'createdAt' | 'updatedAt' | 'embedding'>): Promise<GameEnrichment> {
    console.log("DrizzleEnrichmentRepository: Adding new enrichment", enrichmentData);
    try {
      const [newEnrichment] = await db
        .insert(gameEnrichmentTable)
        .values({
          ...enrichmentData,
          // createdAt and updatedAt might be set by default in DB schema (e.g., DEFAULT NOW())
          // If not, they should be set here: createdAt: new Date(), updatedAt: new Date()
        })
        .returning(); // Ensure your DB driver supports .returning()
      
      if (!newEnrichment) {
        throw new Error("Failed to create new enrichment, no data returned.");
      }
      console.log("DrizzleEnrichmentRepository: Enrichment added successfully", newEnrichment);
      return newEnrichment;
    } catch (error) {
      console.error("DrizzleEnrichmentRepository: Error adding enrichment:", error);
      throw new Error("Failed to add enrichment to database.");
    }
  }
  */
}

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
