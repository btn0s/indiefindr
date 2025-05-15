import type {
  Game,
  GameWithSubmitter,
} from "@/lib/repositories/game-repository";
import type { SteamRawData } from "@/types/steam"; // For rawData type if needed for intermediate processing

// --- View Model Interfaces ---

/**
 * View model for game cards, grids, and feed items.
 * Designed to provide all necessary data directly to UI components
 * like GameCard, GameCardMini, etc.
 */
export interface GameCardViewModel {
  id: number;
  title: string; // Non-null, with fallback
  steamAppid: string | null;
  shortDescription: string; // Non-null, with fallback

  // Media URLs (derived from rawData or Steam CDN)
  coverImageUrl: string | null; // Typically a smaller, portrait-oriented image (e.g., capsule)
  headerImageUrl: string | null; // Typically a wider, landscape-oriented image (e.g., header.jpg)
  previewVideoUrl?: string | null; // Optional: URL for a short preview video

  tags: string[]; // Empty array if none
  genres: string[]; // Empty array if none

  // Submitter/Finder Information
  foundByUsername: string | null;
  foundByAvatarUrl: string | null;
  foundAt: string | null; // Formatted time ago string (e.g., "2 days ago")

  // Other useful flags or small pieces of data
  // Example: isFeatured?: boolean;
  // Example: userRating?: number; (if we add ratings)
}

/**
 * View model for a detailed game profile page.
 * Includes all fields from GameCardViewModel and adds more detailed information.
 */
export interface GameProfileViewModel extends GameCardViewModel {
  detailedDescription: string | null;
  developer: string | null;
  publisher: string | null; // Often available in rawData

  videoUrls: {
    type: "steam" | "youtube" | "other";
    url: string;
    title?: string;
    thumbnail?: string;
  }[]; // From rawData.movies, potentially categorized
  screenshotUrls: string[]; // From rawData.screenshots (full size)

  releaseDate: {
    comingSoon: boolean;
    date: string | null; // Formatted date string
  } | null; // From rawData.release_date

  // Potentially more structured data from rawData or enrichment
  // Example: systemRequirements?: { minimum: string; recommended: string };
  // Example: websiteUrl?: string;
  // Example: metacriticScore?: number;
}

// Potentially a simpler list item view model if GameCardViewModel is too heavy for some lists
// export interface GameListItemViewModel { /* ... */ }

// --- Game Service Interface ---

export interface GameService {
  /**
   * Transforms a raw game object (from DB schema) or a GameWithSubmitter
   * (from GameRepository) into a GameCardViewModel.
   * Handles data processing, fallbacks, and URL generation.
   */
  toGameCardViewModel(game: Game | GameWithSubmitter): GameCardViewModel;

  /**
   * Transforms an array of raw game objects or GameWithSubmitter objects
   * into an array of GameCardViewModels.
   */
  toGameCardViewModels(
    games: (Game | GameWithSubmitter)[]
  ): GameCardViewModel[];

  /**
   * Transforms a raw game object (from DB schema) or a GameWithSubmitter
   * (from GameRepository) into a GameProfileViewModel.
   * This would typically be used when you have already fetched a comprehensive
   * game object for a profile page.
   */
  toGameProfileViewModel(
    game: Game | GameWithSubmitter /*Potentially needs more enriched input*/
  ): GameProfileViewModel;

  /**
   * Example of a method that might fetch data AND transform:
   * Fetches a game by its ID using the GameRepository (or direct DB access)
   * and transforms it into a GameProfileViewModel.
   * This is useful if the service layer is also responsible for some data fetching orchestration.
   *
   * NOTE: For TH-218, we might start with transformation methods only,
   * and integrate fetching later if the pattern becomes clear.
   * The ticket mentions "transformation of raw data from repositories",
   * implying the service primarily transforms already-fetched data.
   */
  // getGameProfileViewModelById(id: number): Promise<GameProfileViewModel | null>;

  // --- Utility/Helper functions (could be private or exposed if generally useful) ---
  // These might live in a separate utils file but are conceptually part of the service's domain.

  // getImageUrlFromRawData(rawData: SteamRawData | null, type: "header" | "capsule" | "screenshot", index?: number): string | null;
  // formatReleaseDate(releaseDateRaw: any): string | null;
  // formatTimeAgo(date: string | Date | null): string | null;
}

// --- Game Service Implementation ---

/**
 * Provides methods to transform raw game data from repositories
 * into structured view models suitable for UI components.
 */
export class DefaultGameService implements GameService {
  public toGameCardViewModel(
    game: Game | GameWithSubmitter
  ): GameCardViewModel {
    // TODO: Implement transformation logic
    // For now, return a placeholder or throw an error
    const rawData = game.rawData as SteamRawData | null; // Type assertion for easier access

    // Helper to safely access properties from rawData, particularly from Steam
    const getSteamRawDataProperty = <T extends keyof SteamRawData>(
      property: T
    ): SteamRawData[T] | undefined => {
      if (rawData && typeof rawData === "object" && property in rawData) {
        return rawData[property];
      }
      return undefined;
    };

    // Fallback values
    const title = game.title ?? "Untitled Game";
    const shortDescription =
      game.descriptionShort ?? "No description available.";
    const genres = game.genres ?? [];
    const tags = game.tags ?? [];

    // Submitter info (handle if 'game' is GameWithSubmitter)
    const foundByUsername =
      "foundByUsername" in game ? game.foundByUsername : null;
    const foundByAvatarUrl =
      "foundByAvatarUrl" in game ? game.foundByAvatarUrl : null;

    // TODO: Implement actual image URL extraction logic
    const getCoverImageUrl = (): string | null => {
      if (rawData?.capsule_image) return rawData.capsule_image;
      if (game.steamAppid)
        return `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`;
      return null;
    };
    const coverImageUrl = getCoverImageUrl();

    const getHeaderImageUrl = (): string | null => {
      if (rawData?.header_image) return rawData.header_image;
      if (game.steamAppid)
        return `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`;
      return null;
    };
    const headerImageUrl = getHeaderImageUrl();

    // TODO: Implement preview video URL extraction
    const previewVideoUrl = rawData?.movies?.[0]?.mp4?.["480"] || null;

    // TODO: Implement date formatting for foundAt
    const foundAt = game.createdAt
      ? new Date(game.createdAt).toLocaleDateString()
      : null; // Placeholder

    return {
      id: game.id,
      title,
      steamAppid: game.steamAppid,
      shortDescription,
      coverImageUrl,
      headerImageUrl,
      previewVideoUrl,
      tags,
      genres,
      foundByUsername: foundByUsername ?? null,
      foundByAvatarUrl: foundByAvatarUrl ?? null,
      foundAt,
    };
  }

  public toGameCardViewModels(
    games: (Game | GameWithSubmitter)[]
  ): GameCardViewModel[] {
    return games.map((game) => this.toGameCardViewModel(game));
  }

  public toGameProfileViewModel(
    game: Game | GameWithSubmitter
  ): GameProfileViewModel {
    // TODO: Implement transformation logic for the detailed profile view
    // This will be more comprehensive than GameCardViewModel
    // For now, extend from a basic card view and add placeholders

    const cardViewModel = this.toGameCardViewModel(game);
    const rawData = game.rawData as SteamRawData | null;

    return {
      ...cardViewModel,
      detailedDescription:
        game.descriptionDetailed ?? cardViewModel.shortDescription,
      developer: game.developer ?? null,
      publisher: rawData?.publishers?.[0] ?? null, // Example: extract publisher
      videoUrls:
        rawData?.movies?.map((m) => ({
          type: "steam",
          url: m.mp4.max,
          title: m.name,
          thumbnail: m.thumbnail,
        })) ?? [],
      screenshotUrls: rawData?.screenshots?.map((s) => s.path_full) ?? [],
      releaseDate: rawData?.release_date
        ? {
            comingSoon: rawData.release_date.coming_soon,
            date: rawData.release_date.date,
          }
        : null,
      // ... other GameProfileViewModel specific fields
    };
  }

  // --- Private Helper Methods for Transformations ---
  // (Example: Can be added later or moved to a utils file)

  // private getImageUrl(
  //   rawData: SteamRawData | null,
  //   steamAppId: string | null,
  //   type: "header" | "capsule" | "screenshot",
  //   screenshotIndex: number = 0
  // ): string | null {
  //   if (type === "capsule" && rawData?.capsule_image) return rawData.capsule_image;
  //   if (type === "header" && rawData?.header_image) return rawData.header_image;
  //   if (type === "screenshot" && rawData?.screenshots?.[screenshotIndex]?.path_full) {
  //     return rawData.screenshots[screenshotIndex].path_full;
  //   }
  //   // Fallback to Steam CDN if appid available
  //   if (steamAppId) {
  //     if (type === "header" || type === "capsule") { // Steam uses header.jpg for both general display
  //       return `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;
  //     }
  //   }
  //   return null;
  // }

  // private formatTimeAgo(dateInput: string | Date | null): string | null {
  //   if (!dateInput) return null;
  //   // Placeholder for a real time_ago function (e.g., using date-fns)
  //   try {
  //     const date = new Date(dateInput);
  //     return `${Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24))} days ago`;
  //   } catch {
  //     return "Recently";
  //   }
  // }
}

// Optional: Export an instance of the service for easy import elsewhere
// export const gameService = new DefaultGameService();
