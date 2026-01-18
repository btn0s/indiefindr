import { acquireRateLimit } from "./rate-limiter";

const STEAMSPY_API_BASE = "https://steamspy.com/api.php";

export type SteamSpyData = {
  appid: number;
  name: string | null;
  developer: string;
  publisher: string;
  positive: number;
  negative: number;
  owners: string;
  tags: Record<string, number>;
  genre: string;
};

/**
 * Fetch tags directly from Steam store page HTML.
 * This is useful for new/early access games that SteamSpy doesn't have data for.
 */
export async function fetchSteamStoreTags(appId: number): Promise<string[]> {
  try {
    await acquireRateLimit("steam_store", 300);

    const url = `https://store.steampowered.com/app/${appId}/`;
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": "birthtime=0; wants_mature_content=1; lastagecheckage=1-0-1990;",
      },
    });

    if (!response.ok) {
      console.log(`[STEAM-TAGS] Failed to fetch ${appId}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    const tagMatches = html.match(/class="app_tag"[^>]*>([\s\S]*?)<\/a>/g) || [];
    
    const tags: string[] = [];
    for (const match of tagMatches) {
      const innerText = match.match(/>([^<]+)</);
      const tagName = innerText?.[1]?.trim();
      if (tagName && !tags.includes(tagName)) {
        tags.push(tagName);
      }
    }

    return tags.slice(0, 20);
  } catch (error) {
    console.error(`[STEAM-TAGS] Error fetching ${appId}:`, error);
    return [];
  }
}

/**
 * Convert a tag array to a weighted Record format (like SteamSpy returns).
 * Tags are weighted by position (first tag = highest weight).
 */
export function tagsArrayToRecord(tags: string[]): Record<string, number> {
  const record: Record<string, number> = {};
  tags.forEach((tag, index) => {
    // Weight decreases with position (1000, 900, 800, etc.)
    record[tag] = Math.max(1000 - index * 50, 100);
  });
  return record;
}

export async function fetchSteamSpyData(appId: number): Promise<SteamSpyData | null> {
  try {
    await acquireRateLimit("steamspy_api", 1000);

    const url = `${STEAMSPY_API_BASE}?request=appdetails&appid=${appId}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`[STEAMSPY] Failed to fetch ${appId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || !data.appid) {
      return null;
    }

    return {
      appid: data.appid,
      name: data.name || null,
      developer: data.developer || "",
      publisher: data.publisher || "",
      positive: data.positive || 0,
      negative: data.negative || 0,
      owners: data.owners || "",
      tags: data.tags || {},
      genre: data.genre || "",
    };
  } catch (error) {
    console.error(`[STEAMSPY] Error fetching ${appId}:`, error);
    return null;
  }
}

export function getTopTags(tags: Record<string, number>, limit = 10): string[] {
  return Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

const STEAM_CONTENT_DESCRIPTOR_SEXUAL = 3;
const STEAM_CONTENT_DESCRIPTOR_ADULT_ONLY = 4;

export function isAdultContent(contentDescriptorIds: number[]): boolean {
  return (
    contentDescriptorIds.includes(STEAM_CONTENT_DESCRIPTOR_SEXUAL) ||
    contentDescriptorIds.includes(STEAM_CONTENT_DESCRIPTOR_ADULT_ONLY)
  );
}

export function getContentDescriptorIds(steamRawData: Record<string, unknown>): number[] {
  const descriptors = steamRawData?.content_descriptors as { ids?: number[] } | undefined;
  return descriptors?.ids ?? [];
}
