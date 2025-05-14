// src/services/game-service-interface.ts
import type { 
  BaseGameViewModel, 
  GameCardViewModel, 
  GameProfileViewModel, 
  GameListItemViewModel,
  RawGameData
} from "@/types/game-models";

/**
 * GameService interface defining methods for transforming game data
 */
export interface GameService {
  /**
   * Transform raw game data into a game card view model
   * @param gameData Raw game data from database
   * @returns Transformed game card view model
   */
  toGameCardViewModel(gameData: RawGameData): GameCardViewModel;

  /**
   * Transform raw game data into a game profile view model
   * @param gameData Raw game data from database
   * @returns Transformed game profile view model
   */
  toGameProfileViewModel(gameData: RawGameData): GameProfileViewModel;

  /**
   * Transform raw game data into a game list item view model
   * @param gameData Raw game data from database
   * @returns Transformed game list item view model
   */
  toGameListItemViewModel(gameData: RawGameData): GameListItemViewModel;

  /**
   * Transform an array of raw game data into game card view models
   * @param gamesData Array of raw game data
   * @returns Array of transformed game card view models
   */
  toGameCardViewModels(gamesData: RawGameData[]): GameCardViewModel[];

  /**
   * Transform an array of raw game data into game list item view models
   * @param gamesData Array of raw game data
   * @returns Array of transformed game list item view models
   */
  toGameListItemViewModels(gamesData: RawGameData[]): GameListItemViewModel[];

  /**
   * Get the best available image URL for a game
   * @param gameData Raw game data
   * @returns Best available image URL or null if none found
   */
  getBestImageUrl(gameData: RawGameData): string | null;

  /**
   * Get the best available media preview (image or video) for a game
   * @param gameData Raw game data
   * @returns Media preview object with type, URL, and optional thumbnail URL
   */
  getMediaPreview(gameData: RawGameData): GameCardViewModel['mediaPreview'];
}

