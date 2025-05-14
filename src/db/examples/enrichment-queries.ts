import { db } from "@/db";
import {
  externalSourceTable,
  gameEnrichmentTable,
  contentSourceTable,
  enrichmentTagTable,
  enrichmentToTagTable,
  enrichmentInteractionTable,
  profilesTable,
} from "@/db/schema";
import { and, desc, eq, gt, gte, ilike, inArray, lt, sql } from "drizzle-orm";

/**
 * Example queries for accessing enriched game data
 * These functions demonstrate common access patterns for the new schema
 */

/**
 * Get all enriched content for a specific game
 */
export async function getGameEnrichment(gameId: number) {
  return db
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      relevanceScore: gameEnrichmentTable.relevanceScore,
      isVerified: gameEnrichmentTable.isVerified,
      isFeatured: gameEnrichmentTable.isFeatured,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .where(eq(gameEnrichmentTable.gameId, gameId))
    .orderBy(desc(gameEnrichmentTable.relevanceScore));
}

/**
 * Get enriched content for a game filtered by content type
 */
export async function getGameEnrichmentByType(
  gameId: number,
  contentType: string
) {
  return db
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .where(
      and(
        eq(gameEnrichmentTable.gameId, gameId),
        eq(gameEnrichmentTable.contentType, contentType)
      )
    )
    .orderBy(desc(gameEnrichmentTable.publishedAt));
}

/**
 * Get featured enriched content across all games
 */
export async function getFeaturedEnrichment(limit = 10) {
  return db
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      gameId: gameEnrichmentTable.gameId,
      gameTitle: externalSourceTable.title,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .innerJoin(
      externalSourceTable,
      eq(gameEnrichmentTable.gameId, externalSourceTable.id)
    )
    .where(eq(gameEnrichmentTable.isFeatured, true))
    .orderBy(desc(gameEnrichmentTable.publishedAt))
    .limit(limit);
}

/**
 * Get enriched content with specific tags
 */
export async function getEnrichmentByTags(tagNames: string[], limit = 20) {
  return db
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      gameId: gameEnrichmentTable.gameId,
      gameTitle: externalSourceTable.title,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      enrichmentToTagTable,
      eq(gameEnrichmentTable.id, enrichmentToTagTable.enrichmentId)
    )
    .innerJoin(
      enrichmentTagTable,
      eq(enrichmentToTagTable.tagId, enrichmentTagTable.id)
    )
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .innerJoin(
      externalSourceTable,
      eq(gameEnrichmentTable.gameId, externalSourceTable.id)
    )
    .where(inArray(enrichmentTagTable.name, tagNames))
    .orderBy(desc(gameEnrichmentTable.relevanceScore))
    .limit(limit);
}

/**
 * Get the most recent enriched content for a user's library
 */
export async function getRecentEnrichmentForUserLibrary(
  userId: string,
  limit = 10
) {
  const subquery = db.$with("user_games").as(
    db
      .select({
        gameId: externalSourceTable.id,
      })
      .from(externalSourceTable)
      .innerJoin(
        db.schema.library,
        eq(externalSourceTable.id, db.schema.library.gameRefId)
      )
      .where(eq(db.schema.library.userId, userId))
  );

  return db
    .with(subquery)
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      gameId: gameEnrichmentTable.gameId,
      gameTitle: externalSourceTable.title,
    })
    .from(gameEnrichmentTable)
    .innerJoin(subquery, eq(gameEnrichmentTable.gameId, subquery.gameId))
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .innerJoin(
      externalSourceTable,
      eq(gameEnrichmentTable.gameId, externalSourceTable.id)
    )
    .orderBy(desc(gameEnrichmentTable.publishedAt))
    .limit(limit);
}

/**
 * Search for enriched content by title or description
 */
export async function searchEnrichment(searchTerm: string, limit = 20) {
  return db
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      gameId: gameEnrichmentTable.gameId,
      gameTitle: externalSourceTable.title,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .innerJoin(
      externalSourceTable,
      eq(gameEnrichmentTable.gameId, externalSourceTable.id)
    )
    .where(
      or(
        ilike(gameEnrichmentTable.title, `%${searchTerm}%`),
        ilike(gameEnrichmentTable.description, `%${searchTerm}%`)
      )
    )
    .orderBy(desc(gameEnrichmentTable.relevanceScore))
    .limit(limit);
}

/**
 * Get popular enriched content based on user interactions
 */
export async function getPopularEnrichment(
  days = 30,
  interactionType = "view",
  limit = 10
) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  const interactionCounts = db.$with("interaction_counts").as(
    db
      .select({
        enrichmentId: enrichmentInteractionTable.enrichmentId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(enrichmentInteractionTable)
      .where(
        and(
          eq(enrichmentInteractionTable.interactionType, interactionType),
          gte(enrichmentInteractionTable.createdAt, dateThreshold)
        )
      )
      .groupBy(enrichmentInteractionTable.enrichmentId)
  );

  return db
    .with(interactionCounts)
    .select({
      id: gameEnrichmentTable.id,
      title: gameEnrichmentTable.title,
      description: gameEnrichmentTable.description,
      url: gameEnrichmentTable.url,
      thumbnailUrl: gameEnrichmentTable.thumbnailUrl,
      contentType: gameEnrichmentTable.contentType,
      publishedAt: gameEnrichmentTable.publishedAt,
      sourceName: contentSourceTable.name,
      gameId: gameEnrichmentTable.gameId,
      gameTitle: externalSourceTable.title,
      interactionCount: interactionCounts.count,
    })
    .from(gameEnrichmentTable)
    .innerJoin(
      interactionCounts,
      eq(gameEnrichmentTable.id, interactionCounts.enrichmentId)
    )
    .innerJoin(
      contentSourceTable,
      eq(gameEnrichmentTable.sourceId, contentSourceTable.id)
    )
    .innerJoin(
      externalSourceTable,
      eq(gameEnrichmentTable.gameId, externalSourceTable.id)
    )
    .orderBy(desc(interactionCounts.count))
    .limit(limit);
}

/**
 * Record a user interaction with enriched content
 */
export async function recordEnrichmentInteraction(
  userId: string,
  enrichmentId: number,
  interactionType: string,
  metadata: Record<string, any> = {}
) {
  return db
    .insert(enrichmentInteractionTable)
    .values({
      userId,
      enrichmentId,
      interactionType,
      metadata,
    })
    .onConflictDoUpdate({
      target: [
        enrichmentInteractionTable.userId,
        enrichmentInteractionTable.enrichmentId,
        enrichmentInteractionTable.interactionType,
      ],
      set: {
        metadata,
        createdAt: new Date(),
      },
    });
}

/**
 * Add a tag to enriched content
 */
export async function addTagToEnrichment(enrichmentId: number, tagId: number) {
  return db.insert(enrichmentToTagTable).values({
    enrichmentId,
    tagId,
  });
}

/**
 * Create a new enrichment tag
 */
export async function createEnrichmentTag(
  name: string,
  description?: string,
  category?: string
) {
  return db
    .insert(enrichmentTagTable)
    .values({
      name,
      description,
      category,
    })
    .returning();
}

/**
 * Add new enriched content for a game
 */
export async function addGameEnrichment(
  gameId: number,
  sourceId: number,
  contentType: string,
  data: {
    title?: string;
    description?: string;
    url: string;
    thumbnailUrl?: string;
    authorName?: string;
    authorUrl?: string;
    publishedAt?: Date;
    metadata?: Record<string, any>;
    relevanceScore?: number;
    isVerified?: boolean;
    isFeatured?: boolean;
    createdBy?: string;
  }
) {
  return db
    .insert(gameEnrichmentTable)
    .values({
      gameId,
      sourceId,
      contentType,
      title: data.title,
      description: data.description,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      authorName: data.authorName,
      authorUrl: data.authorUrl,
      publishedAt: data.publishedAt,
      metadata: data.metadata,
      relevanceScore: data.relevanceScore,
      isVerified: data.isVerified,
      isFeatured: data.isFeatured,
      createdBy: data.createdBy,
    })
    .returning();
}

/**
 * Create a new content source
 */
export async function createContentSource(
  name: string,
  description?: string,
  baseUrl?: string,
  apiEndpoint?: string
) {
  return db
    .insert(contentSourceTable)
    .values({
      name,
      description,
      baseUrl,
      apiEndpoint,
      isActive: true,
    })
    .returning();
}

// Helper function for the searchEnrichment function
function or(...conditions: unknown[]) {
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

