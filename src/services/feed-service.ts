import type { InferSelectModel } from "drizzle-orm";
import { gameEnrichmentTable } from "@/db/schema"; // Assuming this is the correct path
import type {
  GameCardViewModel,
  GameWithSubmitter,
  Game,
  GameService as IGameService,
} from "./game-service"; // GameCardViewModel will be needed
import type { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // For GameRepository type
import type { DefaultLibraryService } from "./library-service"; // For LibraryService type
// TODO: Import actual EnrichmentRepository when available
// import type { EnrichmentRepository } from "@/lib/repositories/enrichment-repository";

// --- GameEnrichment Type (from Drizzle schema) ---
export type GameEnrichment = InferSelectModel<typeof gameEnrichmentTable>;

// --- Feed Item Types ---
export interface BaseFeedItem {
  feedItemKey: string;
  type: string; // Discriminator
  timestamp: Date; // For sorting
  gameId: number; // ID of the associated game
  gameSteamAppid: string | null; // SteamAppID of the associated game
  gameTitle: string; // Title of the associated game
}

export interface GameContentFeedItem extends BaseFeedItem {
  type: "game_find";
  content: GameCardViewModel; // The game card data itself
}

export interface EnrichmentFeedItemBase extends BaseFeedItem {
  enrichmentId: number; // The ID from the game_enrichment table
  enrichmentCreatorUserId: GameEnrichment["submittedBy"];
  sourceName: GameEnrichment["sourceName"];
  // TODO: Add sourceUrl back if it exists in your gameEnrichmentTable schema and is different from contentJson.url
}

export interface VideoEnrichmentFeedItem extends EnrichmentFeedItemBase {
  type: "video_enrichment";
  videoUrl: string | null;
  videoTitle: string | null;
  videoDescription: string | null;
  thumbnailUrl: string | null;
}

export interface ArticleEnrichmentFeedItem extends EnrichmentFeedItemBase {
  type: "article_enrichment";
  articleTitle: string | null;
  articleSnippet: string | null;
}

export interface ImageEnrichmentFeedItem extends EnrichmentFeedItemBase {
  type: "image_enrichment";
  imageUrl: string | null;
  imageAltText: string | null;
  imageCaption: string | null;
}

export interface AudioEnrichmentFeedItem extends EnrichmentFeedItemBase {
  type: "audio_enrichment";
  audioUrl: string | null;
  audioTitle: string | null;
  audioDescription: string | null;
}

export interface SnippetEnrichmentFeedItem extends EnrichmentFeedItemBase {
  type: "snippet_enrichment";
  text: string | null;
}

export type FeedItem =
  | GameContentFeedItem
  | VideoEnrichmentFeedItem
  | ArticleEnrichmentFeedItem
  | ImageEnrichmentFeedItem
  | AudioEnrichmentFeedItem
  | SnippetEnrichmentFeedItem;

// --- Feed Service Interface ---
export interface FeedService {
  getFeed(options: {
    userId?: string;
    limit?: number;
    page?: number;
  }): Promise<FeedItem[]>;
}

// --- Constants for Feed Logic (can be shared or moved here) ---
const FEED_SIZE = 12; // Default feed size
const FEED_POOL_MULTIPLIER = 3; // How many more items to fetch initially for ranking/filtering
const MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING = 1;
const VECTOR_DIMENSIONS = 1536; // Should match embedding model dimensions

// --- Feed Service Implementation (Placeholder) ---
export class DefaultFeedService implements FeedService {
  private gameService: IGameService;
  private libraryService: DefaultLibraryService;
  private gameRepository: DrizzleGameRepository; // For GameRepository type
  // private enrichmentRepository: EnrichmentRepository; // TODO: Add when available

  constructor(
    gameService: IGameService,
    libraryService: DefaultLibraryService,
    gameRepository: DrizzleGameRepository
    // enrichmentRepository: EnrichmentRepository // TODO: Add when available
  ) {
    this.gameService = gameService;
    this.libraryService = libraryService;
    this.gameRepository = gameRepository;
    // this.enrichmentRepository = enrichmentRepository;
  }

  private _ensureHttps(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("http://")) {
      return url.replace("http://", "https://");
    }
    return url;
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
    games: GameWithSubmitter[], // Assumes GameWithSubmitter has an optional `embedding` field
    userProfileVector: number[]
  ): Promise<GameWithSubmitter[]> {
    const gamesWithScores = games.map((game) => {
      let score = -1;
      if (game.embedding && game.embedding.length === VECTOR_DIMENSIONS) {
        let dotProduct = 0;
        for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
          dotProduct += (game.embedding[i] ?? 0) * userProfileVector[i];
        }
        score = dotProduct;
      }
      // Add similarityScore to the game object for sorting, even if it's not part of GameWithSubmitter type strictly
      return { ...game, similarityScore: score } as GameWithSubmitter & {
        similarityScore: number;
      };
    });

    return gamesWithScores.sort((a, b) => {
      // Ensure createdAt is valid before getTime()
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // Use the asserted similarityScore
      return (b as any).similarityScore - (a as any).similarityScore;
    });
  }

  private _transformEnrichmentToFeedItem(
    enrichment: GameEnrichment,
    parentGame: { id: number; title: string; steamAppid: string | null }
  ): FeedItem | null {
    if (!enrichment.createdAt) {
      console.warn(
        `FeedService: Skipping enrichment ID ${enrichment.id} due to null createdAt.`
      );
      return null;
    }
    const cJson = enrichment.contentJson as Record<string, any> | null;
    const baseEnrichmentItem: Omit<
      EnrichmentFeedItemBase,
      "type" | "feedItemKey"
    > = {
      timestamp: new Date(enrichment.createdAt),
      gameId: parentGame.id,
      gameTitle: parentGame.title,
      gameSteamAppid: parentGame.steamAppid,
      enrichmentId: enrichment.id,
      enrichmentCreatorUserId: enrichment.submittedBy,
      sourceName: enrichment.sourceName,
    };

    switch (enrichment.contentType) {
      case "video_url": {
        const videoTitle =
          cJson && typeof cJson.title === "string" ? cJson.title : null;
        let videoUrl =
          cJson && typeof cJson.url === "string"
            ? this._ensureHttps(cJson.url)
            : null;
        if (
          !videoUrl &&
          typeof enrichment.contentJson === "string" &&
          enrichment.contentJson.startsWith("http")
        ) {
          videoUrl = this._ensureHttps(enrichment.contentJson);
        }
        const videoDescription =
          cJson && typeof cJson.description === "string"
            ? cJson.description
            : null;
        const thumbnailUrl =
          cJson && typeof cJson.thumbnailUrl === "string"
            ? this._ensureHttps(cJson.thumbnailUrl)
            : null;
        if (!videoUrl) return null;
        return {
          ...baseEnrichmentItem,
          type: "video_enrichment",
          feedItemKey: `video_enrichment-${enrichment.id}`,
          videoUrl,
          videoTitle,
          videoDescription,
          thumbnailUrl,
        };
      }
      case "article_url": {
        const articleTitle =
          cJson && typeof cJson.title === "string" ? cJson.title : null;
        const articleSnippet =
          cJson && typeof cJson.snippet === "string" ? cJson.snippet : null;
        return {
          ...baseEnrichmentItem,
          type: "article_enrichment",
          feedItemKey: `article_enrichment-${enrichment.id}`,
          articleTitle,
          articleSnippet,
        };
      }
      case "image_url": {
        let imageUrl =
          cJson && typeof cJson.url === "string"
            ? this._ensureHttps(cJson.url)
            : typeof enrichment.contentJson === "string"
              ? this._ensureHttps(enrichment.contentJson)
              : null;
        const imageAltText =
          cJson && typeof cJson.altText === "string" ? cJson.altText : null;
        const imageCaption =
          cJson && typeof cJson.caption === "string" ? cJson.caption : null;
        if (!imageUrl) return null;
        return {
          ...baseEnrichmentItem,
          type: "image_enrichment",
          feedItemKey: `image_enrichment-${enrichment.id}`,
          imageUrl,
          imageAltText,
          imageCaption,
        };
      }
      case "description":
      case "review_snippet": {
        const text =
          cJson && typeof cJson.text === "string"
            ? cJson.text
            : typeof enrichment.contentJson === "string"
              ? enrichment.contentJson
              : null;
        if (!text) return null;
        return {
          ...baseEnrichmentItem,
          type: "snippet_enrichment",
          feedItemKey: `snippet_enrichment-${enrichment.contentType}-${enrichment.id}`,
          text,
        };
      }
      default:
        const unhandledType: GameEnrichment["contentType"] =
          enrichment.contentType;
        console.warn(
          `FeedService: Unhandled enrichment contentType "${unhandledType}" for enrichment ID ${enrichment.id}. Consider mapping it.`
        );
        return null;
    }
  }

  public async getFeed(options: {
    userId?: string;
    limit?: number;
    page?: number;
  }): Promise<FeedItem[]> {
    const { userId, limit = FEED_SIZE, page = 1 } = options;
    const gamePoolLimit = limit * FEED_POOL_MULTIPLIER;

    let candidateGames: GameWithSubmitter[] = [];
    let userLibraryGameIds: number[] = [];
    const gameIdsForEnrichmentFetching = new Set<number>();

    // 1. Fetch a pool of recent games (with embeddings)
    console.log(
      `FeedService:getFeed - Fetching recent game pool (limit ${gamePoolLimit}, page ${page})`
    );
    let recentGamesPool = await this.gameService.getRecentGames({
      limit: gamePoolLimit,
      page,
    });

    if (userId) {
      // --- Personalized Feed Logic ---
      console.log(`FeedService:getFeed - Personalizing for user ${userId}`);
      userLibraryGameIds =
        await this.libraryService.getUserLibraryGameIds(userId);

      // Filter out games already in the user's library from the recent pool
      const libraryGameIdSet = new Set(userLibraryGameIds);
      candidateGames = recentGamesPool.filter(
        (game) => !libraryGameIdSet.has(game.id)
      );
      console.log(
        `FeedService:getFeed - Filtered recent pool to ${candidateGames.length} non-library games.`
      );

      // Rank the filtered candidate games if library is sufficient
      if (
        userLibraryGameIds.length >= MIN_LIBRARY_SIZE_FOR_AVG_EMBEDDING &&
        candidateGames.length > 0
      ) {
        console.log(
          `FeedService:getFeed - Sufficient library size (${userLibraryGameIds.length}), attempting to rank ${candidateGames.length} games.`
        );
        const libraryEmbeddingsData =
          await this.gameService.getEmbeddingsForGames(userLibraryGameIds);
        const averageVector = this._calculateAverageVector(
          libraryEmbeddingsData.map((e) => e.embedding)
        );

        if (averageVector) {
          console.log(
            `FeedService:getFeed - Calculated average vector. Ranking candidate games.`
          );
          candidateGames = await this._rankGamesBySimilarity(
            candidateGames,
            averageVector
          );
        } else {
          console.log(
            `FeedService:getFeed - Could not calculate average vector. Using recency for candidate games.`
          );
          // Games are already sorted by recency from getRecentGames, then filtered
        }
      } else {
        console.log(
          `FeedService:getFeed - Library too small or no candidates to rank. Using recency for ${candidateGames.length} games.`
        );
        // Games are already sorted by recency then filtered
      }

      // Add (filtered, possibly ranked) candidate games and all library games to enrichment fetching list
      candidateGames.forEach((game) =>
        gameIdsForEnrichmentFetching.add(game.id)
      );
      userLibraryGameIds.forEach((id) => gameIdsForEnrichmentFetching.add(id));
    } else {
      // --- Public Feed Logic ---
      console.log(`FeedService:getFeed - Public feed mode.`);
      candidateGames = recentGamesPool; // Use the full recent pool
      candidateGames.forEach((game) =>
        gameIdsForEnrichmentFetching.add(game.id)
      );
    }

    // At this point, `candidateGames` are the games to be shown as `GameContentFeedItem`s
    // (filtered and ranked if user feed, or just recent if public)

    // 2. Fetch Enrichments for all relevant games
    let allEnrichments: GameEnrichment[] = [];
    if (gameIdsForEnrichmentFetching.size > 0) {
      const gameIdArray = Array.from(gameIdsForEnrichmentFetching).map(String);
      console.log(
        `FeedService:getFeed - Fetching enrichments for ${gameIdArray.length} games.`
      );
      try {
        // const { EnrichmentRepository } = await import("@/lib/repositories/enrichment-repository");
        // allEnrichments = await EnrichmentRepository.getEnrichmentsForGameIds(gameIdArray);
        console.warn(
          "FeedService:getFeed - USING MOCK ENRICHMENT DATA. EnrichmentRepository.getEnrichmentsForGameIds needs implementation."
        );
        const mockEnrichments: GameEnrichment[] = [];
        for (const gameIdStr of gameIdArray) {
          const gameIdNum = parseInt(gameIdStr);
          if (Math.random() > 0.5) {
            mockEnrichments.push({
              id: Math.floor(Math.random() * 100000),
              gameId: gameIdNum,
              contentType: "video_url" as GameEnrichment["contentType"],
              sourceName: "youtube",
              sourceSpecificId: `vid-${gameIdNum}`,
              contentJson: {
                title: "Cool Video Title",
                url: "https://www.youtube.com/embed/example",
                thumbnailUrl: `https://i.ytimg.com/vi/example${gameIdNum}/hqdefault.jpg`,
              },
              submittedBy: "mock-user-id",
              createdAt: new Date(
                Date.now() - Math.random() * 1000 * 3600 * 24 * 5
              ),
              updatedAt: new Date(),
            } as GameEnrichment);
          }
          if (Math.random() > 0.7) {
            mockEnrichments.push({
              id: Math.floor(Math.random() * 100000) + 100000,
              gameId: gameIdNum,
              contentType: "article_url" as GameEnrichment["contentType"],
              sourceName: "blog",
              sourceSpecificId: `art-${gameIdNum}`,
              contentJson: {
                title: "Insightful Article",
                snippet: "This article talks about...",
              },
              submittedBy: "mock-user-id-2",
              createdAt: new Date(
                Date.now() - Math.random() * 1000 * 3600 * 24 * 3
              ),
              updatedAt: new Date(),
            } as GameEnrichment);
          }
        }
        allEnrichments = mockEnrichments;
      } catch (error) {
        console.error(
          "FeedService:getFeed - Error fetching enrichments:",
          error
        );
      }
    }

    // 3. Transform games and enrichments into FeedItem objects
    const feedItems: FeedItem[] = [];

    // Game Content Items (from candidateGames)
    candidateGames.forEach((game) => {
      if (game.createdAt) {
        const cardViewModel = this.gameService.toGameCardViewModel(game);
        feedItems.push({
          feedItemKey: `game_find-${game.id}`,
          type: "game_find",
          timestamp: new Date(game.createdAt ?? new Date()),
          gameId: game.id,
          gameTitle: cardViewModel.title,
          gameSteamAppid: cardViewModel.steamAppid,
          content: cardViewModel,
        });
      } else {
        console.warn(
          `FeedService:getFeed - Skipping game ID ${game.id} (candidate game) from feed due to null createdAt.`
        );
      }
    });

    // Enrichment Feed Items
    // Create a map of all games we might need context for (candidateGames + any library games not in candidateGames)
    const allGamesForEnrichmentContextMap = new Map<
      number,
      GameWithSubmitter | Game
    >();
    candidateGames.forEach((g) => allGamesForEnrichmentContextMap.set(g.id, g));

    const missingGameIdsForContext = new Set<number>();
    if (userId) {
      // Only need to check for missing library games if it's a user feed
      userLibraryGameIds.forEach((libGameId) => {
        if (!allGamesForEnrichmentContextMap.has(libGameId)) {
          missingGameIdsForContext.add(libGameId);
        }
      });
    }

    if (missingGameIdsForContext.size > 0) {
      console.log(
        `FeedService:getFeed - Fetching context for ${missingGameIdsForContext.size} additional library games for enrichments.`
      );
      const missingGames = await this.gameRepository.getGamesByIds(
        Array.from(missingGameIdsForContext)
      );
      missingGames.forEach((g) => allGamesForEnrichmentContextMap.set(g.id, g));
    }

    allEnrichments.forEach((enrichment) => {
      const parentGameData = allGamesForEnrichmentContextMap.get(
        enrichment.gameId
      );
      if (parentGameData) {
        const parentGameInfo = {
          id: parentGameData.id,
          title: parentGameData.title ?? "Unknown Game", // Fallback title
          steamAppid: parentGameData.steamAppid ?? null,
        };
        const feedItem = this._transformEnrichmentToFeedItem(
          enrichment,
          parentGameInfo
        );
        if (feedItem) {
          feedItems.push(feedItem);
        }
      } else {
        // This might happen if an enrichment exists for a game that was filtered out (e.g. old game no longer in recent pool)
        // Or if there's an issue with mock data / real data consistency.
        console.warn(
          `FeedService:getFeed - Could not find parent game context for enrichment ID ${enrichment.id} (Game ID: ${enrichment.gameId})`
        );
      }
    });

    // 4. Sort all feed items by timestamp (descending)
    feedItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 5. Apply the final limit to the combined and sorted list
    const finalFeedItems = feedItems.slice(0, limit);

    console.log(
      `FeedService:getFeed - Returning ${finalFeedItems.length} items for the feed.`
    );
    return finalFeedItems;
  }
}
