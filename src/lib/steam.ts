export type SteamGameData = {
  appid: number;
  screenshots: string[];
  videos: string[];
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  raw: unknown; // Raw Steam API response
};

/**
 * Parse Steam URL to extract AppID
 * Supports formats:
 * - https://store.steampowered.com/app/123456/GameName/
 * - https://steamcommunity.com/app/123456
 * - store.steampowered.com/app/123456
 */
export function parseSteamUrl(url: string): number | null {
  // Normalize URL
  let normalizedUrl = url.trim();

  // Add https:// if missing
  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // Try to extract AppID from various Steam URL patterns
  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/i,
    /steamcommunity\.com\/app\/(\d+)/i,
    /\/app\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1]) {
      const appId = parseInt(match[1], 10);
      if (!isNaN(appId) && appId > 0) {
        return appId;
      }
    }
  }

  // If URL is just a number, treat it as AppID
  const numericMatch = url.trim().match(/^\d+$/);
  if (numericMatch) {
    const appId = parseInt(numericMatch[0], 10);
    if (!isNaN(appId) && appId > 0) {
      return appId;
    }
  }

  return null;
}

type QueueItem = {
  url: string;
  resolve: (data: SteamGameData) => void;
  reject: (error: Error) => void;
};

class SteamQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private readonly delayMs = 200;
  private readonly baseUrl = "https://store.steampowered.com/api";

  async add(steamUrl: string): Promise<SteamGameData> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url: steamUrl, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    let isFirst = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        // Wait 200ms between items (not before the first one)
        if (!isFirst) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
        isFirst = false;

        const data = await this.fetchGameData(item.url);
        item.resolve(data);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;
  }

  private async fetchGameData(steamUrl: string): Promise<SteamGameData> {
    const appId = parseSteamUrl(steamUrl);

    if (!appId) {
      throw new Error(`Invalid Steam URL: ${steamUrl}`);
    }

    const url = `${this.baseUrl}/appdetails?appids=${appId}&l=english`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Steam store data: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const appData = data[appId.toString()];

    if (!appData || !appData.success) {
      throw new Error(`Steam app ${appId} not found or unavailable`);
    }

    const game = appData.data;

    // Extract screenshots
    const screenshots = (
      (game.screenshots as Array<{
        path_full?: string;
        path_thumbnail?: string;
      }>) || []
    )
      .map((s) => s.path_full || s.path_thumbnail)
      .filter((url): url is string => Boolean(url));

    // Extract video URLs
    const videos: string[] = [];
    if (game.movies && Array.isArray(game.movies) && game.movies.length > 0) {
      type Movie = {
        highlight?: boolean;
        id: number;
        hls_h264?: string;
        dash_h264?: string;
        dash_av1?: string;
        mp4?: { max?: string; "480"?: string };
        webm?: { max?: string; "480"?: string };
      };

      const sortedMovies = [...(game.movies as Movie[])].sort((a, b) => {
        if (a.highlight && !b.highlight) return -1;
        if (!a.highlight && b.highlight) return 1;
        return a.id - b.id;
      });

      for (const movie of sortedMovies) {
        const videoUrl =
          movie.hls_h264 ||
          movie.dash_h264 ||
          movie.dash_av1 ||
          movie.mp4?.max ||
          movie.mp4?.["480"] ||
          movie.webm?.max ||
          movie.webm?.["480"];

        if (videoUrl) {
          videos.push(videoUrl);
        }
      }
    }

    return {
      appid: appId,
      screenshots,
      videos,
      title: (game.name as string) || "",
      header_image: (game.header_image as string) || null,
      short_description: (game.short_description as string) || null,
      long_description: (game.detailed_description as string) || null,
      raw: game, // Raw Steam API response
    };
  }
}

// Singleton instance
const steamQueue = new SteamQueue();

/**
 * Fetch Steam game data from a Steam URL.
 * Uses a queue system to prevent overloading with 200ms delay between requests.
 *
 * @param steamUrl - Steam store URL or app ID
 * @returns Promise resolving to game data
 */
export async function fetchSteamGame(steamUrl: string): Promise<SteamGameData> {
  return steamQueue.add(steamUrl);
}
