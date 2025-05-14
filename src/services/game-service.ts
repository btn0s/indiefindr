// src/services/game-service.ts
import type { 
  BaseGameViewModel, 
  GameCardViewModel, 
  GameProfileViewModel, 
  GameListItemViewModel,
  RawGameData
} from "@/types/game-models";
import type { GameService } from "./game-service-interface";
import type { SteamRawData, Screenshot, Movie } from "@/types/steam";
import { ensureHttps } from "@/lib/utils";

/**
 * Implementation of the GameService interface
 */
export class GameServiceImpl implements GameService {
  /**
   * Transform raw game data into a game card view model
   */
  toGameCardViewModel(gameData: RawGameData): GameCardViewModel {
    const baseViewModel = this.toBaseViewModel(gameData);
    const mediaPreview = this.getMediaPreview(gameData);
    
    return {
      ...baseViewModel,
      foundBy: {
        username: gameData.foundByUsername || "IndieFindr",
        avatarUrl: gameData.foundByAvatarUrl || null,
        timestamp: gameData.createdAt,
      },
      mediaPreview,
    };
  }

  /**
   * Transform raw game data into a game profile view model
   */
  toGameProfileViewModel(gameData: RawGameData): GameProfileViewModel {
    const baseViewModel = this.toBaseViewModel(gameData);
    const rawData = gameData.rawData as SteamRawData | null;
    
    return {
      ...baseViewModel,
      detailedDescription: gameData.descriptionDetailed || null,
      developers: rawData?.developers || null,
      publishers: rawData?.publishers || null,
      releaseDate: rawData?.release_date?.date || null,
      isComingSoon: rawData?.release_date?.coming_soon || false,
      genres: gameData.genres || null,
      media: {
        screenshots: this.transformScreenshots(rawData?.screenshots || []),
        videos: this.transformVideos(rawData?.movies || []),
      },
      foundBy: {
        username: gameData.foundByUsername || "IndieFindr",
        avatarUrl: gameData.foundByAvatarUrl || null,
        timestamp: gameData.createdAt,
      },
    };
  }

  /**
   * Transform raw game data into a game list item view model
   */
  toGameListItemViewModel(gameData: RawGameData): GameListItemViewModel {
    return this.toBaseViewModel(gameData);
  }

  /**
   * Transform an array of raw game data into game card view models
   */
  toGameCardViewModels(gamesData: RawGameData[]): GameCardViewModel[] {
    return gamesData.map(gameData => this.toGameCardViewModel(gameData));
  }

  /**
   * Transform an array of raw game data into game list item view models
   */
  toGameListItemViewModels(gamesData: RawGameData[]): GameListItemViewModel[] {
    return gamesData.map(gameData => this.toGameListItemViewModel(gameData));
  }

  /**
   * Get the best available image URL for a game
   */
  getBestImageUrl(gameData: RawGameData): string | null {
    const rawData = gameData.rawData as SteamRawData | null;
    
    // Define potential cover art URLs in order of preference
    const imageUrlFromSteam = gameData.steamAppid
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${gameData.steamAppid}/header.jpg`
      : null;
    
    // Ensure all potential URLs are HTTPS
    const secureImageUrl = ensureHttps(imageUrlFromSteam);
    const secureCapsuleImage = ensureHttps(rawData?.capsule_image);
    const secureCapsuleImageV5 = ensureHttps(rawData?.capsule_imagev5);
    const secureScreenshotPathFull = ensureHttps(
      rawData?.screenshots?.[0]?.path_full
    );
    const secureBackgroundRaw = ensureHttps(rawData?.background_raw);
    const secureBackground = ensureHttps(rawData?.background);
    
    // Filter out any null or empty strings
    const potentialCoverUrls = [
      secureImageUrl,
      secureCapsuleImage,
      secureCapsuleImageV5,
      secureScreenshotPathFull,
      secureBackgroundRaw,
      secureBackground,
    ].filter((url): url is string => typeof url === "string" && url.length > 0);
    
    // Return the first valid URL or null if none found
    return potentialCoverUrls[0] || null;
  }

  /**
   * Get the best available media preview (image or video) for a game
   */
  getMediaPreview(gameData: RawGameData): GameCardViewModel['mediaPreview'] {
    const rawData = gameData.rawData as SteamRawData | null;
    
    // Check for videos first
    const firstVideo = rawData?.movies?.[0];
    if (firstVideo) {
      return {
        type: "video",
        url: ensureHttps(firstVideo.mp4.max) || null,
        thumbnailUrl: ensureHttps(firstVideo.thumbnail) || null,
      };
    }
    
    // Then check for screenshots
    const firstScreenshot = rawData?.screenshots?.[0];
    if (firstScreenshot) {
      return {
        type: "image",
        url: ensureHttps(firstScreenshot.path_full) || null,
      };
    }
    
    // Then check for header image
    const headerImage = gameData.steamAppid
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${gameData.steamAppid}/header.jpg`
      : null;
    
    if (headerImage) {
      return {
        type: "image",
        url: ensureHttps(headerImage),
      };
    }
    
    // No media found
    return {
      type: "none",
      url: null,
    };
  }

  /**
   * Create a base game view model from raw game data
   * @private
   */
  private toBaseViewModel(gameData: RawGameData): BaseGameViewModel {
    return {
      id: gameData.id,
      title: gameData.title,
      description: gameData.descriptionShort,
      steamAppId: gameData.steamAppid,
      tags: gameData.tags,
      imageUrl: this.getBestImageUrl(gameData),
      platformUrls: {
        steam: gameData.steamAppid 
          ? `https://store.steampowered.com/app/${gameData.steamAppid}` 
          : undefined,
      },
    };
  }

  /**
   * Transform Steam screenshots to view model format
   * @private
   */
  private transformScreenshots(screenshots: Screenshot[]): GameProfileViewModel['media']['screenshots'] {
    return screenshots.map(screenshot => ({
      id: screenshot.id,
      thumbnailUrl: ensureHttps(screenshot.path_thumbnail) || "",
      fullUrl: ensureHttps(screenshot.path_full) || "",
    }));
  }

  /**
   * Transform Steam videos to view model format
   * @private
   */
  private transformVideos(movies: Movie[]): GameProfileViewModel['media']['videos'] {
    return movies.map(movie => ({
      id: movie.id,
      name: movie.name,
      thumbnailUrl: ensureHttps(movie.thumbnail) || "",
      webmUrl: ensureHttps(movie.webm.max) || "",
      mp4Url: ensureHttps(movie.mp4.max) || "",
    }));
  }
}

