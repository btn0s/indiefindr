import SteamUser from 'steam-user';
import { parseSteamUrl } from './parser';
import { retry } from '../utils/retry';

export type SteamStoreData = {
  appid: number;
  name: string;
  description: string | null;
  header_image: string | null;
  screenshots: string[];
  videos: string[];
  tags: Record<string, number>;
};

// Cache for tag ID -> name mapping
let tagNameCache: Map<string, string> | null = null;

export type SteamReviewSummary = {
  review_score: number;
  review_score_desc: string;
  total_positive: number;
  total_negative: number;
  total_reviews: number;
};

/**
 * Steam Store API Provider
 * Fetches game details from Steam Store API
 */
export class SteamStoreProvider {
  private readonly baseUrl = 'https://store.steampowered.com/api';
  
  async fetchGameDetails(appId: number): Promise<SteamStoreData> {
    const url = `${this.baseUrl}/appdetails?appids=${appId}&l=english`;
    
    const response = await retry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch Steam store data: ${res.status} ${res.statusText}`);
        }
        return res;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryable: (error) => {
          if (error instanceof TypeError) return true;
          const status = parseInt(error.message?.match(/\d+/)?.[0] || '0');
          return status >= 500 || status === 429;
        },
      }
    );
    
    const data = await response.json();
    const appData = data[appId.toString()];
    
    if (!appData || !appData.success) {
      throw new Error(`Steam app ${appId} not found or unavailable`);
    }
    
    const game = appData.data;
    
    // Extract screenshots
    const screenshots = (game.screenshots || []).map((s: any) => s.path_full || s.path_thumbnail).filter(Boolean);
    
    // Extract video URLs from movies/trailers
    // Prefer highlight trailers, then any trailer
    // Prefer MP4 max quality, fallback to 480p, then WebM
    const videos: string[] = [];
    if (game.movies && game.movies.length > 0) {
      // Sort: highlight trailers first, then by ID
      const sortedMovies = [...game.movies].sort((a: any, b: any) => {
        if (a.highlight && !b.highlight) return -1;
        if (!a.highlight && b.highlight) return 1;
        return a.id - b.id;
      });

      for (const movie of sortedMovies) {
        // Prefer MP4 max, then MP4 480p, then WebM max, then WebM 480p
        const videoUrl =
          movie.mp4?.max ||
          movie.mp4?.['480'] ||
          movie.webm?.max ||
          movie.webm?.['480'];
        
        if (videoUrl) {
          videos.push(videoUrl);
          // Limit to first 3 videos for card display
          if (videos.length >= 3) break;
        }
      }
    }
    
    // Extract tags (from categories/genres)
    const tags: Record<string, number> = {};
    if (game.genres) {
      game.genres.forEach((genre: any) => {
        tags[genre.description] = 1;
      });
    }
    if (game.categories) {
      game.categories.forEach((cat: any) => {
        tags[cat.description] = (tags[cat.description] || 0) + 0.5;
      });
    }
    
    return {
      appid: appId,
      name: game.name,
      description: game.detailed_description || game.short_description || null,
      header_image: game.header_image || null,
      screenshots: screenshots.slice(0, 10), // Limit to 10 screenshots
      videos,
      tags,
    };
  }
}

/**
 * Steam Reviews Provider
 * Fetches review summary from Steam Store API
 */
export class SteamReviewsProvider {
  private readonly baseUrl = 'https://store.steampowered.com/appreviews';
  
  async fetchReviewSummary(appId: number): Promise<SteamReviewSummary> {
    const url = `${this.baseUrl}/${appId}?json=1&language=english&purchase_type=all`;
    
    const response = await retry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch Steam reviews: ${res.status} ${res.statusText}`);
        }
        return res;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryable: (error) => {
          if (error instanceof TypeError) return true;
          const status = parseInt(error.message?.match(/\d+/)?.[0] || '0');
          return status >= 500 || status === 429;
        },
      }
    );
    
    const data = await response.json();
    
    if (!data.query_summary) {
      return {
        review_score: 0,
        review_score_desc: 'No reviews',
        total_positive: 0,
        total_negative: 0,
        total_reviews: 0,
      };
    }
    
    const summary = data.query_summary;
    
    return {
      review_score: summary.review_score || 0,
      review_score_desc: summary.review_score_desc || 'No reviews',
      total_positive: summary.total_positive || 0,
      total_negative: summary.total_negative || 0,
      total_reviews: summary.total_reviews || 0,
    };
  }
}

/**
 * Fetches the tag ID -> name mapping from Steam
 */
async function fetchTagNameMap(): Promise<Map<string, string>> {
  if (tagNameCache) return tagNameCache;

  const response = await fetch(
    'https://store.steampowered.com/tagdata/populartags/english'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch tag names: ${response.status}`);
  }

  const tags: Array<{ tagid: number; name: string }> = await response.json();
  tagNameCache = new Map(tags.map((t) => [String(t.tagid), t.name]));
  return tagNameCache;
}

/**
 * Steam Tags Provider using steam-user library
 * Fetches community tags via anonymous login and getProductInfo()
 */
export class SteamTagsProvider {
  private readonly timeoutMs = 45000;

  async fetchTags(appId: number): Promise<Record<string, number>> {
    const [tagIds, tagNameMap] = await Promise.all([
      this.fetchTagIds(appId),
      fetchTagNameMap(),
    ]);

    // Convert tag IDs to names with vote counts as weights
    const tags: Record<string, number> = {};
    for (const [tagId, voteCount] of Object.entries(tagIds)) {
      const tagName = tagNameMap.get(tagId);
      if (tagName) {
        tags[tagName] = voteCount;
      }
    }

    return tags;
  }

  private fetchTagIds(appId: number): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      const client = new SteamUser();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          client.logOff();
          reject(new Error(`Steam client timeout after ${this.timeoutMs}ms`));
        }
      }, this.timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          client.logOff();
        }
      };

      client.on('error', (err) => {
        cleanup();
        reject(err);
      });

      client.on('loggedOn', () => {
        client.getProductInfo([appId], [], true, (err, apps) => {
          if (err) {
            cleanup();
            reject(err);
            return;
          }

          const appInfo = apps[appId];
          const storeTags = appInfo?.appinfo?.common?.store_tags || {};

          cleanup();
          resolve(storeTags);
        });
      });

      client.logOn({ anonymous: true });
    });
  }
}

/**
 * Main Steam data fetcher that combines all providers
 */
export async function fetchSteamGameData(steamUrl: string): Promise<{
  storeData: SteamStoreData;
  reviewSummary: SteamReviewSummary;
  tags: Record<string, number>;
}> {
  const appId = parseSteamUrl(steamUrl);

  if (!appId) {
    throw new Error(`Invalid Steam URL: ${steamUrl}`);
  }

  const storeProvider = new SteamStoreProvider();
  const reviewsProvider = new SteamReviewsProvider();
  const tagsProvider = new SteamTagsProvider();

  // Fetch all data in parallel - tags now come from steam-user
  const [storeData, reviewSummary, tags] = await Promise.all([
    storeProvider.fetchGameDetails(appId),
    reviewsProvider.fetchReviewSummary(appId),
    tagsProvider.fetchTags(appId),
  ]);

  return {
    storeData,
    reviewSummary,
    tags,
  };
}
