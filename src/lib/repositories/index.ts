import { DrizzleGameRepository } from "./drizzle-game-repository";
import { GameRepository } from "./game-repository";

// Singleton instance of the game repository
let gameRepositoryInstance: GameRepository | null = null;

/**
 * Get the game repository instance
 * @returns The game repository instance
 */
export function getGameRepository(): GameRepository {
  if (!gameRepositoryInstance) {
    gameRepositoryInstance = new DrizzleGameRepository();
  }
  return gameRepositoryInstance;
}

// Export types and interfaces
export * from "./game-repository";

