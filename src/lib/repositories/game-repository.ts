import { SQL } from "drizzle-orm";
import { externalSourceTable } from "@/db/schema";

// Define the types for game data
export type Game = typeof externalSourceTable.$inferSelect;
export type GameInsert = typeof externalSourceTable.$inferInsert;
export type GameUpdate = Partial<GameInsert>;

// Define search parameters interface
export interface GameSearchParams {
  query?: string;
  tags?: string[];
  genres?: string[];
  limit?: number;
  offset?: number;
  excludeIds?: number[];
  orderBy?: "newest" | "popular" | "relevance";
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
   * @param excludeIds IDs to exclude from results
   * @returns Array of similar games
   */
  getSimilar(gameId: number, limit?: number, excludeIds?: number[]): Promise<Game[]>;

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
   * Count games matching a condition
   * @param condition SQL condition
   * @returns Number of games matching the condition
   */
  count(condition?: SQL): Promise<number>;
}

