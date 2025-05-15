import { DrizzleLibraryRepository } from "@/lib/repositories/library-repository";
import type { LibraryEntry } from "@/lib/repositories/library-repository";

export interface LibraryService {
  addGameToUserLibrary(
    userId: string,
    gameId: number
  ): Promise<{ success: boolean; error?: string; entry?: LibraryEntry }>;
  removeGameFromUserLibrary(
    userId: string,
    gameId: number
  ): Promise<{ success: boolean; error?: string }>;
  getUserLibraryGameIds(userId: string): Promise<number[]>;
  isGameInUserLibrary(userId: string, gameId: number): Promise<boolean>;
}

export class DefaultLibraryService implements LibraryService {
  private libraryRepository: DrizzleLibraryRepository;

  constructor() {
    this.libraryRepository = new DrizzleLibraryRepository();
  }

  async addGameToUserLibrary(
    userId: string,
    gameId: number
  ): Promise<{ success: boolean; error?: string; entry?: LibraryEntry }> {
    if (!userId || !gameId) {
      return { success: false, error: "User ID and Game ID are required." };
    }
    console.log(
      `LibraryService: Attempting to add game ${gameId} to library for user ${userId}`
    );
    try {
      const existingEntry = await this.libraryRepository.find(userId, gameId);
      if (existingEntry) {
        console.log(
          `LibraryService: Game ${gameId} already in library for user ${userId}`
        );
        return {
          success: true,
          error: "Game already in library.",
          entry: existingEntry,
        }; // Or just success: true if no error message needed
      }

      const newEntry = await this.libraryRepository.add(userId, gameId);
      if (!newEntry) {
        console.error(
          `LibraryService: Failed to add game ${gameId} to library for user ${userId} at repository level.`
        );
        return { success: false, error: "Failed to add game to library." };
      }

      console.log(
        `LibraryService: Game ${gameId} added to library for user ${userId}`
      );
      return { success: true, entry: newEntry };
    } catch (error) {
      console.error(
        `LibraryService: Error adding game ${gameId} to library for user ${userId}:`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      };
    }
  }

  async removeGameFromUserLibrary(
    userId: string,
    gameId: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId || !gameId) {
      return { success: false, error: "User ID and Game ID are required." };
    }
    console.log(
      `LibraryService: Attempting to remove game ${gameId} from library for user ${userId}`
    );
    try {
      const result = await this.libraryRepository.remove(userId, gameId);
      if (!result.success) {
        console.warn(
          `LibraryService: Failed to remove game ${gameId} for user ${userId} at repository, or game was not in library.`
        );
        // The repository returns success:false if DB error OR if no rows were affected.
        // We might want to differentiate, but for now, this is okay.
        return {
          success: false,
          error: "Failed to remove game from library or game not found.",
        };
      }
      console.log(
        `LibraryService: Game ${gameId} removed from library for user ${userId}`
      );
      return { success: true };
    } catch (error) {
      console.error(
        `LibraryService: Error removing game ${gameId} from library for user ${userId}:`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      };
    }
  }

  async getUserLibraryGameIds(userId: string): Promise<number[]> {
    if (!userId) return [];
    try {
      return await this.libraryRepository.getAllGameIdsByUserId(userId);
    } catch (error) {
      console.error(
        `LibraryService: Error fetching library game IDs for user ${userId}:`,
        error
      );
      return [];
    }
  }

  async isGameInUserLibrary(userId: string, gameId: number): Promise<boolean> {
    if (!userId || !gameId) return false;
    try {
      const entry = await this.libraryRepository.find(userId, gameId);
      return !!entry;
    } catch (error) {
      console.error(
        `LibraryService: Error checking if game ${gameId} is in library for user ${userId}:`,
        error
      );
      return false;
    }
  }
}

// Optional: Export an instance for simpler usage
// export const libraryService = new DefaultLibraryService();
