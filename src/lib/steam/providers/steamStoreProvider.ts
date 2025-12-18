const STEAM_API_BASE = 'https://store.steampowered.com/api';

export interface SteamGameData {
  steam_appid: number;
  name: string;
  short_description?: string;
  header_image?: string;
  screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
  }

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

  // Normalize the data
  return {
    steam_appid: gameData.steam_appid,
    name: gameData.name,
    description: gameData.short_description || '',
    header_image: gameData.header_image || '',
    screenshots: gameData.screenshots
      ? gameData.screenshots.map((s) => s.path_full)
      : [],
    developers: gameData.developers || [],
    publishers: gameData.publishers || [],
    genres: gameData.genres
      ? gameData.genres.map((g) => g.description)
      : [],
    tags,
  };
}
