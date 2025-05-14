// src/services/index.ts
import type { GameService } from "./game-service-interface";
import { GameServiceImpl } from "./game-service";

// Create a singleton instance of the GameService
const gameService: GameService = new GameServiceImpl();

// Export the service instance and types
export { gameService };
export type { GameService } from "./game-service-interface";

