import type { InferSelectModel } from "drizzle-orm";
import { gameEnrichmentTable } from "@/lib/db/schema"; // Assuming this is the correct path
import type {
  GameCardViewModel,
  GameWithSubmitter,
  Game,
  GameService as IGameService,
} from "./game-service"; // GameCardViewModel will be needed
import type { DrizzleGameRepository } from "@/lib/repositories/game-repository"; // For GameRepository type
import type { DefaultLibraryService } from "./library-service"; // For LibraryService type
import {
  DrizzleEnrichmentRepository,
  type GameEnrichment,
} from "@/lib/repositories/enrichment-repository";

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

const VIDEO_IGNORE_SOURCES = ["steam"];
const IMAGE_IGNORE_SOURCES = ["steam"];
const ARTICLE_IGNORE_SOURCES = ["steam"];
const SNIPPET_IGNORE_SOURCES = ["steam"];
const REVIEW_SNIPPET_IGNORE_SOURCES = ["steam"];

// --- Feed Service Implementation (Placeholder) ---
export class DefaultFeedService implements FeedService {
  private gameService: IGameService;
  private libraryService: DefaultLibraryService;
  private gameRepository: DrizzleGameRepository; // For GameRepository type
  private enrichmentRepository: DrizzleEnrichmentRepository; // Added

  constructor(
    gameService: IGameService,
    libraryService: DefaultLibraryService,
    gameRepository: DrizzleGameRepository,
    enrichmentRepository: DrizzleEnrichmentRepository // Added
  ) {
    this.gameService = gameService;
    this.libraryService = libraryService;
    this.gameRepository = gameRepository;
    this.enrichmentRepository = enrichmentRepository; // Added
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

  private _stripHtmlAndSnip(
    html: string | null,
    maxLength: number = 150
  ): string | null {
    if (!html) return null;
    const plainText = html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(); // Strip HTML tags and normalize whitespace
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + "...";
  }

  private _transformEnrichmentToFeedItem(
    enrichment: GameEnrichment,
    parentGame: { id: number; title: string; steamAppid: string | null }
  ): FeedItem | null {
    console.log(
      `FeedService._transformEnrichmentToFeedItem BEGIN: enrichmentId: ${enrichment.id}, dbContentType: '${enrichment.contentType}', gameId: ${enrichment.gameId}`
    );

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

    let resultFeedItem: FeedItem | null = null;

    switch (enrichment.contentType) {
      case "video_url": {
        if (VIDEO_IGNORE_SOURCES.includes(enrichment.sourceName)) {
          console.warn(
            `FeedService: Skipping video_url enrichment ID ${enrichment.id} because its sourceName ('${enrichment.sourceName}') is in VIDEO_IGNORE_SOURCES.`
          );
          resultFeedItem = null;
          break;
        }
        const videoTitle =
          cJson && typeof cJson.name === "string"
            ? cJson.name // Use .name from cJson for title
            : cJson && typeof cJson.title === "string"
              ? cJson.title
              : null; // Fallback
        let videoUrl =
          typeof enrichment.contentValue === "string" &&
          enrichment.contentValue.startsWith("http")
            ? this._ensureHttps(enrichment.contentValue)
            : null;
        // Fallback to cJson.url if contentValue wasn't the primary source or was null
        if (!videoUrl && cJson && typeof cJson.url === "string") {
          videoUrl = this._ensureHttps(cJson.url);
        }
        const thumbnailUrl =
          cJson && typeof cJson.thumbnail === "string"
            ? this._ensureHttps(cJson.thumbnail)
            : null; // Use .thumbnail
        const videoDescription =
          cJson && typeof cJson.description === "string"
            ? cJson.description
            : null; // Optional

        if (!videoUrl) {
          console.warn(
            `FeedService: video_url enrichment ID ${enrichment.id} missing videoUrl from contentValue or cJson.url.`
          );
          resultFeedItem = null;
          break;
        }
        resultFeedItem = {
          ...baseEnrichmentItem,
          type: "video_enrichment",
          feedItemKey: `video_enrichment-${enrichment.id}`,
          videoUrl,
          videoTitle,
          videoDescription,
          thumbnailUrl,
        };
        break;
      }
      case "article_url": {
        if (ARTICLE_IGNORE_SOURCES.includes(enrichment.sourceName)) {
          console.warn(
            `FeedService: Skipping article_url enrichment ID ${enrichment.id} because its sourceName ('${enrichment.sourceName}') is in ARTICLE_IGNORE_SOURCES.`
          );
          resultFeedItem = null;
          break;
        }
        const articleTitle =
          cJson && typeof cJson.title === "string" ? cJson.title : null;
        const articleSnippet =
          cJson && typeof cJson.snippet === "string" ? cJson.snippet : null;
        // Assuming article_url itself might be in source_url or content_value if not in cJson
        // For now, ArticleEnrichmentDisplay relies on sourceName and title/snippet.
        // If the URL is crucial here, it needs to be explicitly extracted.
        resultFeedItem = {
          ...baseEnrichmentItem,
          type: "article_enrichment",
          feedItemKey: `article_enrichment-${enrichment.id}`,
          articleTitle,
          articleSnippet,
        };
        break;
      }
      case "image_url": {
        if (IMAGE_IGNORE_SOURCES.includes(enrichment.sourceName)) {
          console.warn(
            `FeedService: Skipping image_url enrichment ID ${enrichment.id} because its sourceName ('${enrichment.sourceName}') is in IMAGE_IGNORE_SOURCES.`
          );
          resultFeedItem = null;
          break;
        }
        let imageUrl =
          typeof enrichment.contentValue === "string" &&
          enrichment.contentValue.startsWith("http")
            ? this._ensureHttps(enrichment.contentValue)
            : null;
        // Fallback to cJson.url if contentValue wasn't the primary source or was null
        if (!imageUrl && cJson && typeof cJson.url === "string") {
          imageUrl = this._ensureHttps(cJson.url);
        }
        const imageAltText =
          cJson && typeof cJson.altText === "string"
            ? cJson.altText
            : parentGame.title
              ? `${cJson?.type || "Image"} for ${parentGame.title}`
              : null; // Default alt text
        const imageCaption =
          cJson && typeof cJson.caption === "string" ? cJson.caption : null;

        if (!imageUrl) {
          console.warn(
            `FeedService: image_url enrichment ID ${enrichment.id} missing imageUrl from contentValue or cJson.url.`
          );
          resultFeedItem = null;
          break;
        }
        resultFeedItem = {
          ...baseEnrichmentItem,
          type: "image_enrichment",
          feedItemKey: `image_enrichment-${enrichment.id}`,
          imageUrl,
          imageAltText,
          imageCaption,
        };
        break;
      }
      case "description": {
        if (SNIPPET_IGNORE_SOURCES.includes(enrichment.sourceName)) {
          console.warn(
            `FeedService: Skipping description (snippet) enrichment ID ${enrichment.id} because its sourceName ('${enrichment.sourceName}') is in SNIPPET_IGNORE_SOURCES.`
          );
          resultFeedItem = null;
          break;
        }
        const rawHtml = enrichment.contentValue;
        let text = this._stripHtmlAndSnip(rawHtml, 280);

        if (!text && cJson && typeof cJson.text === "string") {
          text = cJson.text;
        }

        if (!text) {
          console.warn(
            `FeedService: description enrichment ID ${enrichment.id} resulted in empty text.`
          );
          resultFeedItem = null;
          break;
        }
        resultFeedItem = {
          ...baseEnrichmentItem,
          type: "snippet_enrichment",
          feedItemKey: `snippet_enrichment-desc-${enrichment.id}`,
          text,
        };
        break;
      }
      case "review_snippet": {
        if (REVIEW_SNIPPET_IGNORE_SOURCES.includes(enrichment.sourceName)) {
          console.warn(
            `FeedService: Skipping review_snippet enrichment ID ${enrichment.id} because its sourceName ('${enrichment.sourceName}') is in REVIEW_SNIPPET_IGNORE_SOURCES.`
          );
          resultFeedItem = null;
          break;
        }
        // For now, we don't have the snippet text, so we skip this type.
        // Future: could create a ReviewLinkFeedItem or adapt if snippet text is added to DB.
        console.warn(
          `FeedService: review_snippet enrichment ID ${enrichment.id} - actual snippet text not available in DB. Skipping.`
        );
        resultFeedItem = null;
        break;
      }
      default:
        const unhandledType: GameEnrichment["contentType"] =
          enrichment.contentType;
        console.warn(
          `FeedService._transformEnrichmentToFeedItem: Unhandled DB contentType "${unhandledType}" for enrichment ID ${enrichment.id}.`
        );
        resultFeedItem = null;
    }
    console.log(
      `FeedService._transformEnrichmentToFeedItem END: enrichmentId: ${enrichment.id}, constructed FeedItem.type: ${resultFeedItem?.type || "null"}`
    );
    return resultFeedItem;
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

    console.log(
      `FeedService:getFeed - Fetching recent game pool (limit ${gamePoolLimit}, page ${page})`
    );
    let recentGamesPool = await this.gameService.getRecentGames({
      limit: gamePoolLimit,
      page,
    });

    if (userId) {
      console.log(`FeedService:getFeed - Personalizing for user ${userId}`);
      userLibraryGameIds =
        await this.libraryService.getUserLibraryGameIds(userId);
      const libraryGameIdSet = new Set(userLibraryGameIds);
      candidateGames = recentGamesPool.filter(
        (game) => !libraryGameIdSet.has(game.id)
      );
      console.log(
        `FeedService:getFeed - Filtered recent pool to ${candidateGames.length} non-library games.`
      );
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
        }
      } else {
        console.log(
          `FeedService:getFeed - Library too small or no candidates to rank. Using recency for ${candidateGames.length} games.`
        );
      }
      candidateGames.forEach((game) =>
        gameIdsForEnrichmentFetching.add(game.id)
      );
      userLibraryGameIds.forEach((id) => gameIdsForEnrichmentFetching.add(id));
    } else {
      console.log(`FeedService:getFeed - Public feed mode.`);
      candidateGames = recentGamesPool;
      candidateGames.forEach((game) =>
        gameIdsForEnrichmentFetching.add(game.id)
      );
    }

    let allEnrichments: GameEnrichment[] = [];
    if (gameIdsForEnrichmentFetching.size > 0) {
      const gameIdArrayForRepo = Array.from(gameIdsForEnrichmentFetching);
      console.log(
        `FeedService:getFeed - Fetching enrichments from DB for ${gameIdArrayForRepo.length} games.`
      );
      try {
        allEnrichments =
          await this.enrichmentRepository.getEnrichmentsForGameIds(
            gameIdArrayForRepo
          );
        console.log(
          `FeedService:getFeed - Successfully fetched ${allEnrichments.length} enrichments from DB.`
        );
      } catch (error) {
        console.error(
          "FeedService:getFeed - Error fetching enrichments from DB:",
          error
        );
        allEnrichments = [];
      }
    }

    const feedItems: FeedItem[] = [];
    // Game Content Items
    candidateGames.forEach((game) => {
      if (game.createdAt) {
        const cardViewModel = this.gameService.toGameCardViewModel(game);
        const gameFeedItem: GameContentFeedItem = {
          feedItemKey: `game_find-${game.id}`,
          type: "game_find",
          timestamp: new Date(game.createdAt ?? new Date()),
          gameId: game.id,
          gameTitle: cardViewModel.title,
          gameSteamAppid: cardViewModel.steamAppid,
          content: cardViewModel,
        };
        // console.log("FeedService: Pushing GameContentFeedItem:", JSON.stringify(gameFeedItem, null, 2)); // Debug log
        feedItems.push(gameFeedItem);
      } else {
        console.warn(
          `FeedService:getFeed - Skipping game ID ${game.id} (candidate game) from feed due to null createdAt.`
        );
      }
    });

    // Enrichment Feed Items
    const allGamesForEnrichmentContextMap = new Map<
      number,
      GameWithSubmitter | Game
    >();
    candidateGames.forEach((g) => allGamesForEnrichmentContextMap.set(g.id, g));
    const missingGameIdsForContext = new Set<number>();
    if (userId) {
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
          title: parentGameData.title ?? "Unknown Game",
          steamAppid: parentGameData.steamAppid ?? null,
        };
        const transformedEnrichmentItem = this._transformEnrichmentToFeedItem(
          enrichment,
          parentGameInfo
        );
        if (transformedEnrichmentItem) {
          // 3. Log the transformedEnrichmentItem before pushing
          console.log(
            "FeedService:getFeed - Pushing to feedItems:",
            JSON.stringify(transformedEnrichmentItem, null, 2)
          );
          feedItems.push(transformedEnrichmentItem);
        }
      } else {
        console.warn(
          `FeedService:getFeed - Could not find parent game context for enrichment ID ${enrichment.id} (Game ID: ${enrichment.gameId})`
        );
      }
    });

    feedItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const finalFeedItems = feedItems.slice(0, limit);
    // 4. Log before returning from getFeed
    console.log(
      "FeedService:getFeed - FINALIZED (first item type if any):",
      finalFeedItems.length > 0 ? finalFeedItems[0].type : "empty_feed"
    );
    // For more detail on all items being returned:
    // console.log("FeedService:getFeed - FINALIZED Full finalFeedItems:", JSON.stringify(finalFeedItems, null, 2));
    return finalFeedItems;
  }
}
