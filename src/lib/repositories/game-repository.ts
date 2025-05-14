import { externalSourceTable } from "@/db/schema";
import { db } from "@/db";
import {
  eq,
  desc,
  sql as drizzleSql,
  count as drizzleCount,
  or,
  ilike,
  not,
  inArray,
  and,
  SQL,
  // ilike, or, and, not, inArray, gte, lte will be added as needed by other methods
} from "drizzle-orm";

// Define the types for game data
export type Game = typeof externalSourceTable.$inferSelect;
export type GameInsert = typeof externalSourceTable.$inferInsert;
export type GameUpdate = Partial<GameInsert>;

// Define search parameters interface
export interface GameSearchParams {
  query?: string;
  tags?: string[]; // Search within the tags array
  genres?: string[]; // Search within the genres array
  limit?: number;
  offset?: number;
  excludeIds?: number[];
  orderBy?: "newest" | "popular" | "relevance"; // "popular" might need view counts or similar, "relevance" for text search
  isFeatured?: boolean; // Added to allow filtering by featured status
  steamAppid?: string; // Added for specific lookup
  externalId?: string; // Added for specific lookup
  userId?: string; // For getByUser logic if integrated into search
}

// Define the repository interface
export interface GameRepository {
  /**
   * Get a game by its ID
   * @param id The game ID
   * @returns The game or null if not found
   */
  getById(id: number): Promise<Game | null>;

  /**
   * Get a game by its Steam App ID
   * @param steamAppid The Steam App ID
   * @returns The game or null if not found
   */
  getBySteamAppId(steamAppid: string): Promise<Game | null>;

  /**
   * Search for games based on various criteria
   * @param params Search parameters
   * @returns Array of games matching the criteria
   */
  search(params: GameSearchParams): Promise<Game[]>;

  /**
   * Get featured games
   * @param limit Maximum number of games to return
   * @returns Array of featured games
   */
  getFeatured(limit?: number): Promise<Game[]>;

  /**
   * Get recently added games
   * @param limit Maximum number of games to return
   * @returns Array of recently added games
   */
  getRecent(limit?: number): Promise<Game[]>;

  /**
   * Get games by user (games found by a specific user)
   * @param userId The user ID
   * @param limit Maximum number of games to return
   * @returns Array of games found by the user
   */
  getByUser(userId: string, limit?: number): Promise<Game[]>;

  /**
   * Get similar games based on vector embedding similarity
   * @param gameId The reference game ID
   * @param limit Maximum number of games to return
   * @param excludeIds IDs to exclude from results (optional)
   * @returns Array of similar games
   */
  getSimilar(
    gameId: number,
    limit?: number,
    excludeIds?: number[]
  ): Promise<Game[]>;

  /**
   * Create a new game
   * @param game The game data to insert
   * @returns The created game
   */
  create(game: GameInsert): Promise<Game>;

  /**
   * Update an existing game
   * @param id The game ID
   * @param data The data to update
   * @returns The updated game
   */
  update(id: number, data: GameUpdate): Promise<Game | null>;

  /**
   * Delete a game
   * @param id The game ID
   * @returns True if deleted, false if not found
   */
  delete(id: number): Promise<boolean>;

  /**
   * Count games matching a condition or all games if no condition.
   * @param params Optional search parameters to count based on a filter.
   * @returns Number of games matching the condition
   */
  count(params?: GameSearchParams): Promise<number>;
}

// Placeholder for the DrizzleGameRepository implementation
// The actual implementation will be refactored in subsequent steps.
export class DrizzleGameRepository implements GameRepository {
  async getById(id: number): Promise<Game | null> {
    const result = await db
      .select()
      .from(externalSourceTable)
      .where(eq(externalSourceTable.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getBySteamAppId(steamAppid: string): Promise<Game | null> {
    // The schema has a unique `steam_appid` column and also `external_id`.
    // This method specifically targets `steam_appid`.
    const result = await db
      .select()
      .from(externalSourceTable)
      .where(eq(externalSourceTable.steamAppid, steamAppid))
      .limit(1);
    return result[0] || null;
  }

  async search(params: GameSearchParams): Promise<Game[]> {
    const { limit = 20, offset = 0, orderBy = "newest" } = params;
    const whereClause = this.buildWhereClause(params);

    let queryBuilder = db.select().from(externalSourceTable).$dynamic();

    if (whereClause) {
      queryBuilder = queryBuilder.where(whereClause);
    }

    // Apply ordering
    let orderedQuery;
    switch (orderBy) {
      case "popular":
        orderedQuery = queryBuilder.orderBy(
          desc(externalSourceTable.createdAt),
          desc(externalSourceTable.id)
        );
        break;
      case "relevance":
        orderedQuery = queryBuilder.orderBy(
          desc(externalSourceTable.createdAt),
          desc(externalSourceTable.id)
        );
        break;
      case "newest":
      default:
        orderedQuery = queryBuilder.orderBy(
          desc(externalSourceTable.createdAt),
          desc(externalSourceTable.id)
        );
        break;
    }

    const paginatedQuery = orderedQuery.limit(limit).offset(offset);

    return paginatedQuery.execute();
  }

  async getFeatured(limit: number = 10): Promise<Game[]> {
    return this.search({
      isFeatured: true,
      limit,
      orderBy: "newest", // Or perhaps a specific "featured_order" if that exists
    });
  }

  async getRecent(limit: number = 10): Promise<Game[]> {
    return this.search({ limit, orderBy: "newest" });
  }

  async getByUser(userId: string, limit: number = 10): Promise<Game[]> {
    return this.search({ userId, limit, orderBy: "newest" });
  }

  async getSimilar(
    gameId: number,
    limit: number = 10,
    excludeIds?: number[]
  ): Promise<Game[]> {
    // Step 1: Get the embedding of the reference game
    const referenceGame = await db
      .select({ embedding: externalSourceTable.embedding })
      .from(externalSourceTable)
      .where(eq(externalSourceTable.id, gameId))
      .limit(1);

    if (!referenceGame[0]?.embedding) {
      console.warn(
        `[GameRepository.getSimilar] Reference game ID ${gameId} not found or has no embedding.`
      );
      return [];
    }
    const referenceEmbedding = referenceGame[0].embedding;

    // Step 2: Find games with similar embeddings
    // The operator `<=>` is for cosine distance (lower is better) from pgvector
    // Ensure the `embedding` column has an appropriate index (e.g., HNSW or IVFFlat) for performance.
    const distance = drizzleSql<number>`${externalSourceTable.embedding} <=> ${referenceEmbedding}`;

    const conditions: SQL[] = [];
    // Exclude the reference game itself
    conditions.push(not(eq(externalSourceTable.id, gameId)));

    if (excludeIds && excludeIds.length > 0) {
      conditions.push(not(inArray(externalSourceTable.id, excludeIds)));
    }

    // Add a threshold for distance if needed, e.g., distance < 0.5
    // For now, just ordering by distance and taking the top N.
    // conditions.push(lt(distance, 0.5)); // Example: lt is not imported yet

    const similarGames = await db
      .select()
      .from(externalSourceTable)
      .where(and(...conditions))
      .orderBy(distance) // Order by distance (ascending, as lower is more similar for cosine distance)
      .limit(limit);

    return similarGames;
  }

  async create(game: GameInsert): Promise<Game> {
    const result = await db
      .insert(externalSourceTable)
      .values(game)
      .returning();
    if (result.length === 0) {
      // This case should ideally not happen if the insert is successful without errors
      // and the database is configured to return the inserted row.
      throw new Error("Game creation failed, no record returned.");
    }
    return result[0];
  }

  async update(id: number, data: GameUpdate): Promise<Game | null> {
    // Consider adding a lastUpdatedAt timestamp update here if not handled by DB trigger
    // e.g. { ...data, lastUpdatedAt: new Date() }
    const result = await db
      .update(externalSourceTable)
      .set(data)
      .where(eq(externalSourceTable.id, id))
      .returning();
    return result[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(externalSourceTable)
      .where(eq(externalSourceTable.id, id))
      .returning({ id: externalSourceTable.id }); // Check if a row was actually deleted
    return result.length > 0;
  }

  // Helper function to build dynamic where clauses for search and count
  private buildWhereClause(params: GameSearchParams): SQL | undefined {
    const conditions = [];

    if (params.query && params.query.trim() !== "") {
      const queryLower = params.query.toLowerCase().trim();
      if (queryLower) {
        conditions.push(
          or(
            ilike(externalSourceTable.title, `%${queryLower}%`),
            ilike(externalSourceTable.descriptionShort, `%${queryLower}%`),
            ilike(externalSourceTable.developer, `%${queryLower}%`)
          )
        );
      }
    }

    if (params.tags && params.tags.length > 0) {
      // Drizzle doesn't have a direct array_contains or overlap for text arrays easily.
      // Using a workaround: array_to_string and LIKE. This is not SARGable and can be slow.
      // For better performance, a FTS setup on tags or a different schema might be needed.
      // Or use raw SQL with array operators like && (overlap) or @> (contains).
      // Example with @> (Postgres specific): sql`${externalSourceTable.tags} @> ARRAY[${params.tags.join(',')}]::text[]`
      // For now, sticking to a portable-ish (but less efficient) string conversion for each tag.
      const tagConditions = params.tags.map((tag) =>
        ilike(
          drizzleSql`array_to_string(${externalSourceTable.tags}, ' ')`,
          `%${tag}%`
        )
      );
      if (tagConditions.length > 0) conditions.push(or(...tagConditions));
    }

    if (params.genres && params.genres.length > 0) {
      const genreConditions = params.genres.map((genre) =>
        ilike(
          drizzleSql`array_to_string(${externalSourceTable.genres}, ' ')`,
          `%${genre}%`
        )
      );
      if (genreConditions.length > 0) conditions.push(or(...genreConditions));
    }

    if (params.excludeIds && params.excludeIds.length > 0) {
      conditions.push(not(inArray(externalSourceTable.id, params.excludeIds)));
    }

    if (typeof params.isFeatured === "boolean") {
      conditions.push(eq(externalSourceTable.isFeatured, params.isFeatured));
    }

    if (params.steamAppid) {
      conditions.push(eq(externalSourceTable.steamAppid, params.steamAppid));
    }

    if (params.externalId) {
      conditions.push(eq(externalSourceTable.externalId, params.externalId));
    }

    if (params.userId) {
      conditions.push(eq(externalSourceTable.foundBy, params.userId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async count(params: GameSearchParams = {}): Promise<number> {
    const whereClause = this.buildWhereClause(params);

    const queryInitial = db
      .select({ value: drizzleCount(externalSourceTable.id) })
      .from(externalSourceTable);

    // Conditionally apply the .where() method only if whereClause is defined.
    // The type of queryInitial changes if .where() is applied.
    // So, we await the appropriate query.
    let result;
    if (whereClause) {
      result = await queryInitial.where(whereClause);
    } else {
      result = await queryInitial;
    }

    return result[0]?.value || 0;
  }
}
