import type {
  Game,
  GameInsert, // Ensure GameInsert is imported if needed by new service method indirectly
  GameWithSubmitter,
} from "@/lib/repositories/game-repository";
import { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // For direct instantiation
import { EnrichmentService } from "@/services/enrichment-service"; // Import EnrichmentService
import { DefaultLibraryService } from "@/services/library-service"; // Import LibraryService
import type { SteamRawData } from "@/types/steam"; // For rawData type if needed for intermediate processing
import { enrichSteamAppId } from "@/lib/workers/steam-enrichment"; // Import the worker

// --- Constants for Personalized Feed Logic ---
const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 1;
const FEED_SIZE = 12;
const VECTOR_DIMENSIONS = 1536; // Should match your embedding model dimensions

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
  enrichedMedia?: any[]; // Placeholder for media from EnrichmentService
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
    game: Game | GameWithSubmitter /*Potentially needs more enriched input*/,
    enrichedMedia?: any[] // Added to accept enriched media
  ): GameProfileViewModel;

  /**
   * Fetches a game by its ID using the GameRepository, enriches it using EnrichmentService,
   * and transforms it into a GameProfileViewModel.
   */
  getGameProfileViewModelById(id: number): Promise<GameProfileViewModel | null>;

  /**
   * Fetches recent games using the GameRepository and transforms them into GameCardViewModels.
   * Suitable for use in feeds or API responses that need recent game data in UI-ready format.
   */
  getRecentGamesForFeed(
    limit?: number,
    page?: number
  ): Promise<GameCardViewModel[]>;

  /**
   * Submits a new game by its Steam App ID. Checks for existence,
   * then triggers enrichment and creation if it doesn't exist.
   * Returns status and game data (as GameCardViewModel if successful or game exists).
   */
  submitNewGameBySteamAppId(
    userId: string,
    steamAppId: string
  ): Promise<{
    status: "success" | "error" | "exists";
    message: string;
    game?: GameCardViewModel; // Game data if success or exists
    gameId?: string; // Internal DB ID if exists
  }>;

  /**
   * Fetches a personalized game feed for a user, or a fallback.
   */
  getPersonalizedFeedForUser(
    userId: string,
    limit?: number,
    page?: number
  ): Promise<GameCardViewModel[]>;

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
  private gameRepository: DrizzleGameRepository;
  private libraryService: DefaultLibraryService; // Add libraryService property

  constructor() {
    this.gameRepository = new DrizzleGameRepository();
    this.libraryService = new DefaultLibraryService(); // Instantiate LibraryService
  }

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
    game: Game | GameWithSubmitter,
    enrichedMediaData?: any[] // Accept enriched media
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
      enrichedMedia: enrichedMediaData, // Include the enriched media
    };
  }

  public async getGameProfileViewModelById(
    id: number
  ): Promise<GameProfileViewModel | null> {
    console.log(`GameService: Fetching profile for gameId: ${id}`);
    const baseGameData = await this.gameRepository.getById(id);

    if (!baseGameData) {
      console.warn(`GameService: Game with id ${id} not found.`);
      return null;
    }

    // Call EnrichmentService to get additional media/data
    // For this example, let's assume enrichMedia returns the media directly for simplicity,
    // though in the blueprint it's part of an orchestrating enrichGame method.
    // We'll call a method on EnrichmentService that could conceptually fetch and return data.
    // Let's assume EnrichmentService.enrichMedia was designed to return the media, or we add a new method.
    // For now, we can simulate a call to EnrichmentRepository directly as EnrichmentService doesn't directly return value from enrichMedia.
    // This is a temporary step for speed, ideally EnrichmentService would have a method that returns necessary enriched data.
    let enrichedMedia: any[] = [];
    try {
      // This is a simplified call. In a real scenario, EnrichmentService.enrichGame(String(id)) would be called,
      // and then we might need another method in EnrichmentService or GameRepository to get the newly enriched data.
      // Or EnrichmentService.enrichGame could return the enriched data bundle.
      // For now, let's call a method on EnrichmentRepository directly via EnrichmentService, if it exposed one, or EnrichmentRepository itself.
      // To keep it simple and use existing structure:
      await EnrichmentService.enrichMedia(String(id)); // This populates, but doesn't return the media here
      // To get the media for the view model, we'd typically fetch it *after* enrichment or have enrichMedia return it.
      // Let's assume a (mocked) way to get it for the VM:
      // enrichedMedia = await EnrichmentRepository.getMediaForGame(String(id)); // This would re-fetch mock data

      // Simpler: Let's assume `enrichMedia` could return the media for the purpose of this example path,
      // or `EnrichmentService` gets a new method like `getEnrichedMediaForGame`.
      // For the sake of this edit, let's imagine enrichMedia on EnrichmentService returns something useful for the VM.
      // We'll mock this part slightly from the strict current implementation of EnrichmentService.enrichMedia which is void.

      // To align with blueprint's idea of GameService orchestrating:
      // 1. Fetch base data (done)
      // 2. Trigger enrichment (e.g., EnrichmentService.enrichGame(String(id));)
      // 3. Fetch *all* data needed for profile view model (base + enriched). This might mean EnrichmentRepository needs getWithEnrichedData.

      // For this fast path, let's directly call EnrichmentRepository from here as a placeholder
      // for where GameService would assemble data from multiple sources post-enrichment.
      const { EnrichmentRepository } = await import(
        "@/lib/repositories/enrichment-repository"
      );
      enrichedMedia = await EnrichmentRepository.getMediaForGame(String(id));
    } catch (error) {
      console.error(
        `GameService: Error during enrichment call for gameId ${id}:`,
        error
      );
      // Decide if we should return partially enriched data or null
    }

    // Now transform using the existing method, passing the enriched data
    return this.toGameProfileViewModel(baseGameData, enrichedMedia);
  }

  // New method to get recent games for feed/actions
  public async getRecentGamesForFeed(
    limit: number = FEED_SIZE,
    page: number = 1
  ): Promise<GameCardViewModel[]> {
    console.log(
      `[SERVICE ENTRY] getRecentGamesForFeed CALLED WITH: limit=${limit}, page=${page}`
    );

    const offset = (page - 1) * limit;
    console.log(
      `GameService: Fetching recent games for feed. Limit: ${limit}, Page: ${page}, Offset: ${offset}`
    );
    try {
      // Assuming getRecent in repository now accepts offset
      const recentGamesData = await this.gameRepository.getRecent(
        limit,
        undefined,
        offset
      );
      if (!recentGamesData) {
        return [];
      }
      return this.toGameCardViewModels(recentGamesData);
    } catch (error) {
      console.error(
        "GameService: Error fetching recent games for feed:",
        error
      );
      return [];
    }
  }

  public async submitNewGameBySteamAppId(
    userId: string,
    steamAppId: string
  ): Promise<{
    status: "success" | "error" | "exists";
    message: string;
    game?: GameCardViewModel;
    gameId?: string;
  }> {
    if (!userId || !steamAppId) {
      return {
        status: "error",
        message: "User ID and Steam App ID are required.",
      };
    }
    console.log(
      `GameService: Attempting to submit game by Steam App ID: ${steamAppId} for user ${userId}`
    );

    try {
      // 1. Check if game already exists
      const existingGame =
        await this.gameRepository.getBySteamAppId(steamAppId);

      if (existingGame) {
        console.log(
          `GameService: Game with Steam App ID ${steamAppId} already exists (DB ID: ${existingGame.id}).`
        );
        return {
          status: "exists",
          message: `"${existingGame.title || "This game"}" is already in IndieFindr!`,
          game: this.toGameCardViewModel(existingGame), // Return existing game data as ViewModel
          gameId: existingGame.id.toString(),
        };
      }

      // 2. If not, trigger enrichment (which includes DB upsert via enrichSteamAppId worker)
      console.log(
        `GameService: Game with Steam App ID ${steamAppId} not found. Triggering enrichment.`
      );
      await enrichSteamAppId(steamAppId, userId); // This handles the upsert to gamesTable and enrichmentTable

      // 3. Fetch the newly created/enriched game to return its data
      const newlyCreatedGame =
        await this.gameRepository.getBySteamAppId(steamAppId);
      if (!newlyCreatedGame) {
        // This would be an unexpected state if enrichSteamAppId was supposed to guarantee creation
        console.error(
          `GameService: CRITICAL - Game ${steamAppId} not found after enrichment call.`
        );
        return {
          status: "error",
          message:
            "Game submission process failed unexpectedly after enrichment.",
        };
      }

      console.log(
        `GameService: Game ${steamAppId} submitted and enriched successfully. DB ID: ${newlyCreatedGame.id}`
      );
      return {
        status: "success",
        message: "Game submitted successfully!",
        game: this.toGameCardViewModel(newlyCreatedGame),
      };
    } catch (error: any) {
      console.error(
        `GameService: Error submitting game by Steam App ID ${steamAppId}:`,
        error
      );
      // Specific error from enrichSteamAppId (e.g., Steam API failure)
      if (error.message?.includes("Steam API")) {
        return { status: "error", message: error.message };
      }
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred during game submission.",
      };
    }
  }

  private _calculateAverageVector(
    vectors: (number[] | null)[]
  ): number[] | null {
    const validVectors = vectors.filter(
      (e): e is number[] => e !== null && e.length === VECTOR_DIMENSIONS
    );
    if (!validVectors || validVectors.length === 0) return null;

    const numVectors = validVectors.length;
    const average = new Array(VECTOR_DIMENSIONS).fill(0);

    for (const vector of validVectors) {
      for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
        average[i] += vector[i];
      }
    }
    for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
      average[i] /= numVectors;
    }
    return average;
  }

  private async _rankGamesBySimilarity(
    games: GameWithSubmitter[],
    userProfileVector: number[]
  ): Promise<GameWithSubmitter[]> {
    const gamesWithScores = games.map((game) => {
      let score = -1; // Default score for games without embedding or if no similarity
      if (game.embedding && game.embedding.length === VECTOR_DIMENSIONS) {
        // Cosine similarity calculation (simplified: dot product for normalized vectors)
        // A more robust library might be used for vector math in a production system.
        // For now, assuming pgvector gives us normalized-enough embeddings or this is a proxy.
        // The closer to 1 (or higher dot product for non-normalized but positive vectors), the more similar.
        // If pgvector <=> is cosine distance (0 to 2), then score = 1 - (distance / 2) or similar.
        // For simplicity, let's assume a dot product like similarity or a placeholder.
        // This part would need a proper similarity function.
        // For now, a placeholder:
        let dotProduct = 0;
        for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
          dotProduct += (game.embedding[i] ?? 0) * userProfileVector[i];
        }
        score = dotProduct; // Higher is better
      }
      return { ...game, similarityScore: score };
    });

    // Sort by createdAt (descending), then by similarity score (descending) as a tie-breaker
    return gamesWithScores.sort((a, b) => {
      const dateA = new Date(a.createdAt ?? 0).getTime();
      const dateB = new Date(b.createdAt ?? 0).getTime();

      if (dateB !== dateA) {
        return dateB - dateA; // Most recent first
      }
      return b.similarityScore - a.similarityScore; // Higher score for same timestamp
    });
  }

  public async getPersonalizedFeedForUser(
    userId: string,
    limit: number = FEED_SIZE,
    page: number = 1
  ): Promise<GameCardViewModel[]> {
    console.log(
      `[SERVICE ENTRY] getPersonalizedFeedForUser (New Logic) CALLED WITH: userId=${userId}, limit=${limit}, page=${page}`
    );
    if (!userId) return [];

    const offset = (page - 1) * limit;
    const libraryGameIds =
      await this.libraryService.getUserLibraryGameIds(userId);
    const excludedIds = libraryGameIds.length > 0 ? libraryGameIds : [-1]; // -1 to prevent issues with empty IN () in SQL

    // Fetch a larger pool of recent games to allow for personalization filtering/ranking
    // The pool size can be adjusted based on performance and desired personalization quality.
    const poolLimit = limit * 3; // Fetch 3x the amount needed

    console.log(
      `GameService: Fetching ${poolLimit} recent games (excluding ${
        excludedIds.length
      } library items) for user ${userId}, page ${page} (offset ${offset}).`
    );

    let candidateGamesRaw = await this.gameRepository.getRecent(
      poolLimit,
      excludedIds,
      offset
    );

    if (candidateGamesRaw.length === 0) {
      console.log(
        `GameService: No recent games found for user ${userId} after exclusions.`
      );
      return [];
    }

    // Attempt to personalize (rank) the fetched recent games
    let personalizedRankedGames: GameWithSubmitter[] = candidateGamesRaw;

    if (libraryGameIds.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING) {
      console.log(
        `GameService: User ${userId} library size ${libraryGameIds.length}, attempting to rank recent games.`
      );
      const libraryEmbeddingsData =
        await this.gameRepository.getEmbeddingsForGames(libraryGameIds);
      const averageVector = this._calculateAverageVector(
        libraryEmbeddingsData.map((e) => e.embedding)
      );

      if (averageVector) {
        console.log(
          `GameService: Calculated average vector for user ${userId}. Ranking ${candidateGamesRaw.length} recent games.`
        );
        personalizedRankedGames = await this._rankGamesBySimilarity(
          candidateGamesRaw,
          averageVector
        );
      } else {
        console.log(
          `GameService: Could not calculate average vector for user ${userId}. Using recency order.`
        );
        // Games are already sorted by recency from getRecent()
      }
    } else {
      console.log(
        `GameService: Library size too small for user ${userId} (${libraryGameIds.length}). Using recency order for feed.`
      );
      // Games are already sorted by recency
    }

    // Slice to the final limit after ranking
    const finalGamesRaw = personalizedRankedGames.slice(0, limit);

    console.log(
      `GameService: Returning ${finalGamesRaw.length} personalized/recent games for user ${userId}.`
    );
    return this.toGameCardViewModels(finalGamesRaw);
  }
}

// Optional: Export an instance of the service for easy import elsewhere
// export const gameService = new DefaultGameService();
