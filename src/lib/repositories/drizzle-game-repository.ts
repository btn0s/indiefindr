import { SQL, and, count, desc, eq, ilike, inArray, isNotNull, notInArray, or, sql } from "drizzle-orm";
import { Game, GameInsert, GameRepository, GameSearchParams, GameUpdate } from "./game-repository";
import { db, schema } from "@/db";
import { externalSourceTable } from "@/db/schema";
import { performance } from "perf_hooks";
import { logger } from "@/lib/logger";

/**
 * Implementation of GameRepository using Drizzle ORM
 */
export class DrizzleGameRepository implements GameRepository {
  /**
   * Get a game by its ID
   * @param id The game ID
   * @returns The game or null if not found
   */
  async getById(id: number): Promise<Game | null> {
    try {
      const startTime = performance.now();
      
      const game = await db.query.externalSourceTable.findFirst({
        where: eq(externalSourceTable.id, id),
      });
      
      const endTime = performance.now();
      logger.debug(`getById execution time: ${endTime - startTime}ms`);
      
      return game;
    } catch (error) {
      logger.error("Error in getById:", error);
      throw new Error(`Failed to get game by ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a game by its Steam App ID
   * @param steamAppid The Steam App ID
   * @returns The game or null if not found
   */
  async getBySteamAppId(steamAppid: string): Promise<Game | null> {
    try {
      const startTime = performance.now();
      
      const game = await db.query.externalSourceTable.findFirst({
        where: eq(externalSourceTable.steamAppid, steamAppid),
      });
      
      const endTime = performance.now();
      logger.debug(`getBySteamAppId execution time: ${endTime - startTime}ms`);
      
      return game;
    } catch (error) {
      logger.error("Error in getBySteamAppId:", error);
      throw new Error(`Failed to get game by Steam App ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for games based on various criteria
   * @param params Search parameters
   * @returns Array of games matching the criteria
   */
  async search(params: GameSearchParams): Promise<Game[]> {
    try {
      const startTime = performance.now();
      const { 
        query, 
        tags, 
        genres, 
        limit = 20, 
        offset = 0, 
        excludeIds = [],
        orderBy = "newest" 
      } = params;
      
      let conditions: SQL[] = [];
      
      // Add search query condition if provided
      if (query) {
        const queryTrimmed = query.trim();
        const terms = queryTrimmed.split(/\s+/).filter(Boolean);
        
        if (terms.length > 0) {
          // If multiple terms, search for each term
          const termConditions = terms.map(term => 
            or(
              ilike(schema.externalSourceTable.title, `%${term}%`),
              ilike(schema.externalSourceTable.descriptionShort, `%${term}%`)
            )
          );
          conditions.push(and(...termConditions));
        }
      }
      
      // Add tags condition if provided
      if (tags && tags.length > 0) {
        // Using arrayOverlaps to check if any of the provided tags match
        // Note: This is a simplified version, actual implementation might need adjustment based on DB capabilities
        conditions.push(sql`${schema.externalSourceTable.tags} && ${tags}`);
      }
      
      // Add genres condition if provided
      if (genres && genres.length > 0) {
        conditions.push(sql`${schema.externalSourceTable.genres} && ${genres}`);
      }
      
      // Add excludeIds condition if provided
      if (excludeIds.length > 0) {
        conditions.push(notInArray(schema.externalSourceTable.id, excludeIds));
      }
      
      // Build the query
      let query = db.select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        descriptionDetailed: schema.externalSourceTable.descriptionDetailed,
        developer: schema.externalSourceTable.developer,
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
        embedding: schema.externalSourceTable.embedding,
        enrichmentStatus: schema.externalSourceTable.enrichmentStatus,
        isFeatured: schema.externalSourceTable.isFeatured,
        lastFetched: schema.externalSourceTable.lastFetched,
        createdAt: schema.externalSourceTable.createdAt,
        foundBy: schema.externalSourceTable.foundBy,
      })
      .from(schema.externalSourceTable);
      
      // Add conditions if any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Add ordering
      switch (orderBy) {
        case "newest":
          query = query.orderBy(desc(schema.externalSourceTable.createdAt));
          break;
        case "popular":
          // This is a placeholder - actual implementation would depend on how popularity is determined
          query = query.orderBy(desc(schema.externalSourceTable.id));
          break;
        case "relevance":
          // For relevance, we might need a more complex ordering mechanism
          // This is just a placeholder
          if (query) {
            // If there's a search query, we might want to order by relevance
            // This is a simplified version
            query = query.orderBy(desc(schema.externalSourceTable.id));
          } else {
            // Default to newest if no query
            query = query.orderBy(desc(schema.externalSourceTable.createdAt));
          }
          break;
      }
      
      // Add pagination
      query = query.limit(limit).offset(offset);
      
      // Execute the query
      const results = await query;
      
      const endTime = performance.now();
      logger.debug(`search execution time: ${endTime - startTime}ms`);
      
      return results;
    } catch (error) {
      logger.error("Error in search:", error);
      throw new Error(`Failed to search games: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get featured games
   * @param limit Maximum number of games to return
   * @returns Array of featured games
   */
  async getFeatured(limit: number = 10): Promise<Game[]> {
    try {
      const startTime = performance.now();
      
      const games = await db.select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        descriptionDetailed: schema.externalSourceTable.descriptionDetailed,
        developer: schema.externalSourceTable.developer,
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
        embedding: schema.externalSourceTable.embedding,
        enrichmentStatus: schema.externalSourceTable.enrichmentStatus,
        isFeatured: schema.externalSourceTable.isFeatured,
        lastFetched: schema.externalSourceTable.lastFetched,
        createdAt: schema.externalSourceTable.createdAt,
        foundBy: schema.externalSourceTable.foundBy,
      })
      .from(schema.externalSourceTable)
      .where(eq(schema.externalSourceTable.isFeatured, true))
      .limit(limit);
      
      const endTime = performance.now();
      logger.debug(`getFeatured execution time: ${endTime - startTime}ms`);
      
      return games;
    } catch (error) {
      logger.error("Error in getFeatured:", error);
      throw new Error(`Failed to get featured games: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get recently added games
   * @param limit Maximum number of games to return
   * @returns Array of recently added games
   */
  async getRecent(limit: number = 10): Promise<Game[]> {
    try {
      const startTime = performance.now();
      
      const games = await db.select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        descriptionDetailed: schema.externalSourceTable.descriptionDetailed,
        developer: schema.externalSourceTable.developer,
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
        embedding: schema.externalSourceTable.embedding,
        enrichmentStatus: schema.externalSourceTable.enrichmentStatus,
        isFeatured: schema.externalSourceTable.isFeatured,
        lastFetched: schema.externalSourceTable.lastFetched,
        createdAt: schema.externalSourceTable.createdAt,
        foundBy: schema.externalSourceTable.foundBy,
      })
      .from(schema.externalSourceTable)
      .orderBy(desc(schema.externalSourceTable.createdAt))
      .limit(limit);
      
      const endTime = performance.now();
      logger.debug(`getRecent execution time: ${endTime - startTime}ms`);
      
      return games;
    } catch (error) {
      logger.error("Error in getRecent:", error);
      throw new Error(`Failed to get recent games: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get games by user (games found by a specific user)
   * @param userId The user ID
   * @param limit Maximum number of games to return
   * @returns Array of games found by the user
   */
  async getByUser(userId: string, limit: number = 10): Promise<Game[]> {
    try {
      const startTime = performance.now();
      
      const games = await db.select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        descriptionDetailed: schema.externalSourceTable.descriptionDetailed,
        developer: schema.externalSourceTable.developer,
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
        embedding: schema.externalSourceTable.embedding,
        enrichmentStatus: schema.externalSourceTable.enrichmentStatus,
        isFeatured: schema.externalSourceTable.isFeatured,
        lastFetched: schema.externalSourceTable.lastFetched,
        createdAt: schema.externalSourceTable.createdAt,
        foundBy: schema.externalSourceTable.foundBy,
      })
      .from(schema.externalSourceTable)
      .where(eq(schema.externalSourceTable.foundBy, userId))
      .orderBy(desc(schema.externalSourceTable.createdAt))
      .limit(limit);
      
      const endTime = performance.now();
      logger.debug(`getByUser execution time: ${endTime - startTime}ms`);
      
      return games;
    } catch (error) {
      logger.error("Error in getByUser:", error);
      throw new Error(`Failed to get games by user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get similar games based on vector embedding similarity
   * @param gameId The reference game ID
   * @param limit Maximum number of games to return
   * @param excludeIds IDs to exclude from results
   * @returns Array of similar games
   */
  async getSimilar(gameId: number, limit: number = 5, excludeIds: number[] = []): Promise<Game[]> {
    try {
      const startTime = performance.now();
      
      // First, get the embedding of the reference game
      const referenceGame = await this.getById(gameId);
      
      if (!referenceGame || !referenceGame.embedding) {
        return [];
      }
      
      // Prepare the exclude IDs list (including the reference game ID)
      const idsToExclude = [...excludeIds, gameId];
      
      // Query for similar games using vector similarity
      const similarGames = await db.select({
        id: schema.externalSourceTable.id,
        title: schema.externalSourceTable.title,
        externalId: schema.externalSourceTable.externalId,
        steamAppid: schema.externalSourceTable.steamAppid,
        descriptionShort: schema.externalSourceTable.descriptionShort,
        descriptionDetailed: schema.externalSourceTable.descriptionDetailed,
        developer: schema.externalSourceTable.developer,
        genres: schema.externalSourceTable.genres,
        tags: schema.externalSourceTable.tags,
        rawData: schema.externalSourceTable.rawData,
        embedding: schema.externalSourceTable.embedding,
        enrichmentStatus: schema.externalSourceTable.enrichmentStatus,
        isFeatured: schema.externalSourceTable.isFeatured,
        lastFetched: schema.externalSourceTable.lastFetched,
        createdAt: schema.externalSourceTable.createdAt,
        foundBy: schema.externalSourceTable.foundBy,
      })
      .from(schema.externalSourceTable)
      .where(and(
        notInArray(schema.externalSourceTable.id, idsToExclude),
        isNotNull(schema.externalSourceTable.embedding)
      ))
      .orderBy(sql`(${schema.externalSourceTable.embedding}) <=> ${JSON.stringify(referenceGame.embedding)}`)
      .limit(limit);
      
      const endTime = performance.now();
      logger.debug(`getSimilar execution time: ${endTime - startTime}ms`);
      
      return similarGames;
    } catch (error) {
      logger.error("Error in getSimilar:", error);
      throw new Error(`Failed to get similar games: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new game
   * @param game The game data to insert
   * @returns The created game
   */
  async create(game: GameInsert): Promise<Game> {
    try {
      const startTime = performance.now();
      
      const [createdGame] = await db.insert(schema.externalSourceTable)
        .values(game)
        .returning();
      
      const endTime = performance.now();
      logger.debug(`create execution time: ${endTime - startTime}ms`);
      
      return createdGame;
    } catch (error) {
      logger.error("Error in create:", error);
      throw new Error(`Failed to create game: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update an existing game
   * @param id The game ID
   * @param data The data to update
   * @returns The updated game
   */
  async update(id: number, data: GameUpdate): Promise<Game | null> {
    try {
      const startTime = performance.now();
      
      const [updatedGame] = await db.update(schema.externalSourceTable)
        .set(data)
        .where(eq(schema.externalSourceTable.id, id))
        .returning();
      
      const endTime = performance.now();
      logger.debug(`update execution time: ${endTime - startTime}ms`);
      
      return updatedGame || null;
    } catch (error) {
      logger.error("Error in update:", error);
      throw new Error(`Failed to update game: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a game
   * @param id The game ID
   * @returns True if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    try {
      const startTime = performance.now();
      
      const result = await db.delete(schema.externalSourceTable)
        .where(eq(schema.externalSourceTable.id, id))
        .returning({ id: schema.externalSourceTable.id });
      
      const endTime = performance.now();
      logger.debug(`delete execution time: ${endTime - startTime}ms`);
      
      return result.length > 0;
    } catch (error) {
      logger.error("Error in delete:", error);
      throw new Error(`Failed to delete game: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Count games matching a condition
   * @param condition SQL condition
   * @returns Number of games matching the condition
   */
  async count(condition?: SQL): Promise<number> {
    try {
      const startTime = performance.now();
      
      let query = db.select({ count: count() })
        .from(schema.externalSourceTable);
      
      if (condition) {
        query = query.where(condition);
      }
      
      const result = await query;
      
      const endTime = performance.now();
      logger.debug(`count execution time: ${endTime - startTime}ms`);
      
      return result[0]?.count || 0;
    } catch (error) {
      logger.error("Error in count:", error);
      throw new Error(`Failed to count games: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

