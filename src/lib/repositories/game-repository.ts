import { gamesTable, profilesTable } from "@/db/schema";
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
export type Game = typeof gamesTable.$inferSelect;
export type GameInsert = typeof gamesTable.$inferInsert;
export type GameUpdate = Partial<GameInsert>;

// Ensure GameWithSubmitter is defined (it should be from previous edits)
// If not, it would be:
export type GameWithSubmitter = Game & {
  foundByUsername?: string | null;
  foundByAvatarUrl?: string | null;
};

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
  includeSubmitter?: boolean; // New flag
}

// Define the repository interface
export interface GameRepository {
  /**
   * Get a game by its ID, including submitter information if available.
   * @param id The game ID
   * @returns The game with submitter details or null if not found
   */
  getById(id: number): Promise<GameWithSubmitter | null>;

  /**
   * Get a game by its Steam App ID
   * @param steamAppid The Steam App ID
   * @returns The game or null if not found (consider if this should also be GameWithSubmitter)
   */
  getBySteamAppId(steamAppid: string): Promise<Game | null>;

  /**
   * Search for games based on various criteria
   * @param params Search parameters
   * @returns Array of games matching the criteria
   */
  search(params: GameSearchParams): Promise<GameWithSubmitter[]>;

  /**
   * Get featured games
   * @param limit Maximum number of games to return
   * @returns Array of featured games (potentially with submitter info if underlying search provides it)
   */
  getFeatured(limit?: number): Promise<GameWithSubmitter[]>;

  /**
   * Get recently added games, including submitter info if available.
   * @param limit Maximum number of games to return
   * @returns Array of recently added games with submitter details
   */
  getRecent(limit?: number): Promise<GameWithSubmitter[]>;

  /**
   * Get games by user (games found by a specific user)
   * @param userId The user ID
   * @param limit Maximum number of games to return
   * @returns Array of games found by the user (potentially with submitter info)
   */
  getByUser(userId: string, limit?: number): Promise<GameWithSubmitter[]>;

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
  async getById(id: number): Promise<GameWithSubmitter | null> {
    const result = await db
      .select({
        // Select all fields from gamesTable
        id: gamesTable.id,
        platform: gamesTable.platform,
        externalId: gamesTable.externalId,
        title: gamesTable.title,
        developer: gamesTable.developer,
        descriptionShort: gamesTable.descriptionShort,
        descriptionDetailed: gamesTable.descriptionDetailed,
        genres: gamesTable.genres,
        tags: gamesTable.tags,
        embedding: gamesTable.embedding,
        rawData: gamesTable.rawData,
        enrichmentStatus: gamesTable.enrichmentStatus,
        isFeatured: gamesTable.isFeatured,
        steamAppid: gamesTable.steamAppid,
        lastFetched: gamesTable.lastFetched,
        createdAt: gamesTable.createdAt,
        foundBy: gamesTable.foundBy,
        // Select specific fields from profilesTable for submitter info
        foundByUsername: profilesTable.username,
        foundByAvatarUrl: profilesTable.avatarUrl,
      })
      .from(gamesTable)
      .leftJoin(profilesTable, eq(gamesTable.foundBy, profilesTable.id))
      .where(eq(gamesTable.id, id))
      .limit(1);

    return result[0] || null;
  }

  async getBySteamAppId(steamAppid: string): Promise<Game | null> {
    // The schema has a unique `steam_appid` column and also `external_id`.
    // This method specifically targets `steam_appid`.
    const result = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.steamAppid, steamAppid))
      .limit(1);
    return result[0] || null;
  }

  async search(params: GameSearchParams): Promise<GameWithSubmitter[]> {
    const {
      limit = 20,
      offset = 0,
      orderBy = "newest",
      includeSubmitter = false, // Default to false
    } = params;
    const whereClause = this.buildWhereClause(params);

    // Base query, always select fields for GameWithSubmitter structure
    // If includeSubmitter is false, foundByUsername/AvatarUrl will be null if not joined,
    // or if the left join doesn't find a match.
    let queryCore = db
      .select({
        // Fields from gamesTable (Game part)
        id: gamesTable.id,
        platform: gamesTable.platform,
        externalId: gamesTable.externalId,
        title: gamesTable.title,
        developer: gamesTable.developer,
        descriptionShort: gamesTable.descriptionShort,
        descriptionDetailed: gamesTable.descriptionDetailed,
        genres: gamesTable.genres,
        tags: gamesTable.tags,
        embedding: gamesTable.embedding,
        rawData: gamesTable.rawData,
        enrichmentStatus: gamesTable.enrichmentStatus,
        isFeatured: gamesTable.isFeatured,
        steamAppid: gamesTable.steamAppid,
        lastFetched: gamesTable.lastFetched,
        createdAt: gamesTable.createdAt,
        foundBy: gamesTable.foundBy,
        // Fields from profilesTable (Submitter part) - conditionally populated by JOIN
        foundByUsername: includeSubmitter
          ? profilesTable.username
          : drizzleSql`null`.as<string | null>("foundByUsername"),
        foundByAvatarUrl: includeSubmitter
          ? profilesTable.avatarUrl
          : drizzleSql`null`.as<string | null>("foundByAvatarUrl"),
      })
      .from(gamesTable)
      .$dynamic(); // For conditional parts

    if (includeSubmitter) {
      queryCore = queryCore.leftJoin(
        profilesTable,
        eq(gamesTable.foundBy, profilesTable.id)
      );
    }

    let queryWithConditions = queryCore;
    if (whereClause) {
      queryWithConditions = queryCore.where(whereClause);
    }

    let orderedQuery;
    switch (orderBy) {
      case "popular":
        orderedQuery = queryWithConditions.orderBy(
          desc(gamesTable.createdAt),
          desc(gamesTable.id)
        );
        break;
      case "relevance":
        orderedQuery = queryWithConditions.orderBy(
          desc(gamesTable.createdAt),
          desc(gamesTable.id)
        );
        break;
      case "newest":
      default:
        orderedQuery = queryWithConditions.orderBy(
          desc(gamesTable.createdAt),
          desc(gamesTable.id)
        );
        break;
    }

    const paginatedQuery = orderedQuery.limit(limit).offset(offset);
    const results = await paginatedQuery.execute();

    // Ensure the shape matches GameWithSubmitter. Explicit nulls are fine.
    return results.map((r) => ({
      ...r,
      // If not includeSubmitter, foundByUsername/AvatarUrl were selected as sql`null`
      // so they should exist on `r` but be null.
      // If includeSubmitter was true but no join match, they'd also be null.
    })) as GameWithSubmitter[];
  }

  async getFeatured(limit: number = 10): Promise<GameWithSubmitter[]> {
    // For now, let's make it call search and the API consuming it will pick fields.
    // includeSubmitter: false means foundByUsername/Url will be null from search method.
    const results = await this.search({
      isFeatured: true,
      limit,
      orderBy: "newest",
      includeSubmitter: false,
    });
    return results;
  }

  async getRecent(limit: number = 10): Promise<GameWithSubmitter[]> {
    // Now calls search and explicitly includes submitter info.
    return this.search({ limit, orderBy: "newest", includeSubmitter: true });
  }

  async getByUser(
    userId: string,
    limit: number = 10
  ): Promise<GameWithSubmitter[]> {
    // By default, we might not need submitter info here since we ARE searching by a user.
    // However, search returns GameWithSubmitter[], so we align.
    // If submitter info is truly redundant, the caller can just ignore those fields.
    // Setting includeSubmitter: false as it might be redundant if we already know the user.
    return this.search({
      userId,
      limit,
      orderBy: "newest",
      includeSubmitter: false,
    });
  }

  async getSimilar(
    gameId: number,
    limit: number = 10,
    excludeIds?: number[]
  ): Promise<Game[]> {
    // Step 1: Get the embedding of the reference game
    const referenceGame = await db
      .select({ embedding: gamesTable.embedding })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
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
    const distance = drizzleSql<number>`${gamesTable.embedding} <=> ${referenceEmbedding}`;

    const conditions: SQL[] = [];
    // Exclude the reference game itself
    conditions.push(not(eq(gamesTable.id, gameId)));

    if (excludeIds && excludeIds.length > 0) {
      conditions.push(not(inArray(gamesTable.id, excludeIds)));
    }

    // Add a threshold for distance if needed, e.g., distance < 0.5
    // For now, just ordering by distance and taking the top N.
    // conditions.push(lt(distance, 0.5)); // Example: lt is not imported yet

    const similarGames = await db
      .select()
      .from(gamesTable)
      .where(and(...conditions))
      .orderBy(distance) // Order by distance (ascending, as lower is more similar for cosine distance)
      .limit(limit);

    return similarGames;
  }

  async create(game: GameInsert): Promise<Game> {
    const result = await db.insert(gamesTable).values(game).returning();
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
      .update(gamesTable)
      .set(data)
      .where(eq(gamesTable.id, id))
      .returning();
    return result[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(gamesTable)
      .where(eq(gamesTable.id, id))
      .returning({ id: gamesTable.id }); // Check if a row was actually deleted
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
            ilike(gamesTable.title, `%${queryLower}%`),
            ilike(gamesTable.descriptionShort, `%${queryLower}%`),
            ilike(gamesTable.developer, `%${queryLower}%`)
          )
        );
      }
    }

    if (params.tags && params.tags.length > 0) {
      // Drizzle doesn't have a direct array_contains or overlap for text arrays easily.
      // Using a workaround: array_to_string and LIKE. This is not SARGable and can be slow.
      // For better performance, a FTS setup on tags or a different schema might be needed.
      // Or use raw SQL with array operators like && (overlap) or @> (contains).
      // Example with @> (Postgres specific): sql`${gamesTable.tags} @> ARRAY[${params.tags.join(',')}]::text[]`
      // For now, sticking to a portable-ish (but less efficient) string conversion for each tag.
      const tagConditions = params.tags.map((tag) =>
        ilike(drizzleSql`array_to_string(${gamesTable.tags}, ' ')`, `%${tag}%`)
      );
      if (tagConditions.length > 0) conditions.push(or(...tagConditions));
    }

    if (params.genres && params.genres.length > 0) {
      const genreConditions = params.genres.map((genre) =>
        ilike(
          drizzleSql`array_to_string(${gamesTable.genres}, ' ')`,
          `%${genre}%`
        )
      );
      if (genreConditions.length > 0) conditions.push(or(...genreConditions));
    }

    if (params.excludeIds && params.excludeIds.length > 0) {
      conditions.push(not(inArray(gamesTable.id, params.excludeIds)));
    }

    if (typeof params.isFeatured === "boolean") {
      conditions.push(eq(gamesTable.isFeatured, params.isFeatured));
    }

    if (params.steamAppid) {
      conditions.push(eq(gamesTable.steamAppid, params.steamAppid));
    }

    if (params.externalId) {
      conditions.push(eq(gamesTable.externalId, params.externalId));
    }

    if (params.userId) {
      conditions.push(eq(gamesTable.foundBy, params.userId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async count(params: GameSearchParams = {}): Promise<number> {
    const whereClause = this.buildWhereClause(params);

    const queryInitial = db
      .select({ value: drizzleCount(gamesTable.id) })
      .from(gamesTable);

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
