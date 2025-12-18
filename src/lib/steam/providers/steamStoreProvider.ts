import { retry } from '../../utils/retry';

const STEAM_API_BASE = 'https://store.steampowered.com/api';

export interface SteamMovie {
  id: number;
  name: string;
  thumbnail: string;
  // Old format (legacy)
  webm?: {
    '480'?: string;
    max?: string;
  };
  mp4?: {
    '480'?: string;
    max?: string;
  };
  // New format (current)
  dash_av1?: string;
  dash_h264?: string;
  hls_h264?: string;
  highlight?: boolean;
}

export interface SteamGameData {
  steam_appid: number;
  name: string;
  short_description?: string;
  header_image?: string;
  screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
  movies?: SteamMovie[];
  developers?: string[];
  publishers?: string[];
  genres?: Array<{ id: string; description: string }>;
  categories?: Array<{ id: number; description: string }>;
  release_date?: { coming_soon: boolean; date?: string };
  platforms?: {
    windows?: boolean;
    mac?: boolean;
    linux?: boolean;
  };
}

export interface NormalizedGameData {
  steam_appid: number;
  name: string;
  description: string;
  header_image: string;
  screenshots: string[];
  videos: string[]; // Array of video URLs (preferring highlight trailers, then first trailer)
  developers: string[];
  publishers: string[];
  genres: string[];
  tags: string[];
}

/**
 * Fetch game data from Steam Store API
 */
export async function fetchSteamGameData(
  appId: number
): Promise<NormalizedGameData> {
  const url = `${STEAM_API_BASE}/appdetails?appids=${appId}&cc=US&l=en`;
  
  const response = await retry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Steam API error: ${res.status} ${res.statusText}`);
      }
      return res;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      retryable: (error) => {
        // Retry on network errors and 5xx/429 status codes
        if (error instanceof TypeError) return true;
        const status = parseInt(error.message?.match(/\d+/)?.[0] || '0');
        return status >= 500 || status === 429;
      },
    }
  );

  const data = await response.json();
  const appData = data[appId.toString()];

  if (!appData || !appData.success) {
    throw new Error(`Game ${appId} not found or not available`);
  }

  const gameData: SteamGameData = appData.data;

  // Extract tags from categories (common tags are often in categories)
  const tags: string[] = [];
  if (gameData.categories) {
    tags.push(...gameData.categories.map((cat) => cat.description));
  }

  // Extract video URLs from movies/trailers
  // Prefer highlight trailers, then any trailer
  // Prefer HLS (most compatible), then DASH H.264, then legacy MP4/WebM
  const videos: string[] = [];
  if (gameData.movies && gameData.movies.length > 0) {
    // Sort: highlight trailers first, then by ID
    const sortedMovies = [...gameData.movies].sort((a, b) => {
      if (a.highlight && !b.highlight) return -1;
      if (!a.highlight && b.highlight) return 1;
      return a.id - b.id;
    });

    for (const movie of sortedMovies) {
      // Prefer new format: HLS H.264 (most compatible for web), then DASH H.264
      // Fallback to legacy MP4/WebM formats if new format not available
      const videoUrl =
        movie.hls_h264 ||
        movie.dash_h264 ||
        movie.dash_av1 ||
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

  // Normalize the data
  return {
    steam_appid: gameData.steam_appid,
    name: gameData.name,
    description: gameData.short_description || '',
    header_image: gameData.header_image || '',
    screenshots: gameData.screenshots
      ? gameData.screenshots.map((s) => s.path_full)
      : [],
    videos,
    developers: gameData.developers || [],
    publishers: gameData.publishers || [],
    genres: gameData.genres
      ? gameData.genres.map((g) => g.description)
      : [],
    tags,
  };
}
