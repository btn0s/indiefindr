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
  private _ensureHttps(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("http://")) {
      return url.replace("http://", "https://");
    }
    return url;
  }

  private _formatTimeAgo(
    dateInput: string | Date | null | undefined
  ): string | null {
    if (!dateInput) return null;
    // Basic placeholder - a real implementation would use a library like date-fns
    try {
      const date = new Date(dateInput);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      // For simplicity, older than a week just show date
      return date.toLocaleDateString();
    } catch {
      return "Recently"; // Fallback for invalid date strings
    }
  }

  public toGameCardViewModel(
    game: Game | GameWithSubmitter
  ): GameCardViewModel {
    const rawData = game.rawData as SteamRawData | null;

    const title = game.title ?? "Untitled Game";
    const shortDescription =
      game.descriptionShort ??
      game.descriptionDetailed ??
      "No description available.";
    const genres = game.genres ?? [];
    const tags = game.tags ?? [];

    const foundByUsername =
      "foundByUsername" in game ? (game.foundByUsername ?? null) : null;
    const foundByAvatarUrl =
      "foundByAvatarUrl" in game
        ? this._ensureHttps(game.foundByAvatarUrl)
        : null;
    const foundAt = this._formatTimeAgo(game.createdAt);

    let headerImageUrl: string | null = null;
    if (rawData?.header_image) {
      headerImageUrl = this._ensureHttps(rawData.header_image);
    } else if (game.steamAppid) {
      headerImageUrl = this._ensureHttps(
        `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppid}/header.jpg`
      );
    }

    let coverImageUrl: string | null = null;
    if (rawData?.capsule_image) {
      coverImageUrl = this._ensureHttps(rawData.capsule_image);
    } else if (rawData?.capsule_imagev5) {
      coverImageUrl = this._ensureHttps(rawData.capsule_imagev5);
    } else {
      coverImageUrl = headerImageUrl; // Fallback to header image if no capsule
    }

    let previewVideoUrl: string | null = null;
    if (rawData?.movies && rawData.movies.length > 0) {
      const firstMovie = rawData.movies[0];
      if (firstMovie.mp4?.max) {
        previewVideoUrl = this._ensureHttps(firstMovie.mp4.max);
      } else if (firstMovie.mp4?.["480"]) {
        previewVideoUrl = this._ensureHttps(firstMovie.mp4["480"]);
      }
    }

    return {
      id: game.id,
      title,
      steamAppid: game.steamAppid ?? null,
      shortDescription,
      coverImageUrl,
      headerImageUrl,
      previewVideoUrl,
      tags,
      genres,
      foundByUsername,
      foundByAvatarUrl,
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
    const cardViewModel = this.toGameCardViewModel(game);
    const rawData = game.rawData as SteamRawData | null;

    // Developer and Publisher
    const developer =
      game.developer ??
      (rawData?.developers && rawData.developers.length > 0
        ? rawData.developers.join(", ")
        : null);
    const publisher =
      rawData?.publishers && rawData.publishers.length > 0
        ? rawData.publishers.join(", ")
        : null;

    // Video URLs
    const videoUrls: GameProfileViewModel["videoUrls"] =
      rawData?.movies
        ?.map((movie) => ({
          type: "steam" as const, // Explicitly type as "steam"
          url:
            this._ensureHttps(
              movie.mp4?.max ||
                movie.mp4?.["480"] ||
                movie.webm?.max ||
                movie.webm?.["480"] ||
                ""
            ) || "", // Ensure URL is not null
          title: movie.name,
          thumbnail: this._ensureHttps(movie.thumbnail) ?? undefined, // Ensure undefined if null
        }))
        .filter((v) => v.url) ?? []; // Filter out any videos that ended up with no URL

    // Screenshot URLs
    const screenshotUrls: string[] =
      (rawData?.screenshots
        ?.map((s) => this._ensureHttps(s.path_full))
        .filter(Boolean) as string[]) ?? [];

    // Release Date
    let releaseDate: GameProfileViewModel["releaseDate"] = null;
    if (rawData?.release_date) {
      releaseDate = {
        comingSoon: rawData.release_date.coming_soon,
        // Basic date formatting, a library would be better for robust parsing/formatting
        date: rawData.release_date.date
          ? new Date(rawData.release_date.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "TBA",
      };
    }

    return {
      ...cardViewModel, // Spread the already transformed card view model
      detailedDescription:
        game.descriptionDetailed ?? cardViewModel.shortDescription, // Fallback to short if detailed is null
      developer,
      publisher,
      videoUrls,
      screenshotUrls,
      releaseDate,
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
