// src/types/game-models.ts
import type { SteamRawData } from "./steam";

/**
 * Base game view model with common properties
 */
export interface BaseGameViewModel {
  id: number;
  title: string | null;
  description: string | null;
  steamAppId: string | null;
  tags: string[] | null;
  imageUrl: string | null;
  platformUrls: {
    steam?: string;
    // Future platforms can be added here
  };
}

/**
 * Game card view model for displaying games in grid/list views
 */
export interface GameCardViewModel extends BaseGameViewModel {
  foundBy: {
    username: string | null;
    avatarUrl: string | null;
    timestamp: Date | string | null;
  };
  mediaPreview: {
    type: "image" | "video" | "none";
    url: string | null;
    thumbnailUrl?: string | null;
  };
}

/**
 * Game profile view model for detailed game pages
 */
export interface GameProfileViewModel extends BaseGameViewModel {
  detailedDescription: string | null;
  developers: string[] | null;
  publishers: string[] | null;
  releaseDate: string | null;
  isComingSoon: boolean;
  genres: string[] | null;
  media: {
    screenshots: Array<{
      id: number;
      thumbnailUrl: string;
      fullUrl: string;
    }>;
    videos: Array<{
      id: number;
      name: string;
      thumbnailUrl: string;
      webmUrl: string;
      mp4Url: string;
    }>;
  };
  foundBy: {
    username: string | null;
    avatarUrl: string | null;
    timestamp: Date | string | null;
  };
}

/**
 * Game list item view model for simplified list views
 */
export interface GameListItemViewModel extends BaseGameViewModel {
  // Additional properties specific to list views can be added here
}

/**
 * Raw game data from database
 */
export interface RawGameData {
  id: number;
  platform: string;
  externalId: string;
  title: string | null;
  developer: string | null;
  descriptionShort: string | null;
  descriptionDetailed: string | null;
  genres: string[] | null;
  tags: string[] | null;
  rawData: SteamRawData | null;
  steamAppid: string | null;
  createdAt: Date | string | null;
  foundBy: string | null; // UUID of the user who found the game
  foundByUsername?: string | null; // Username of the user who found the game
  foundByAvatarUrl?: string | null; // Avatar URL of the user who found the game
}

