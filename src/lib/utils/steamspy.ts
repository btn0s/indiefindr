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

const NEGATIVE_VIBES: Record<string, Set<string>> = {
  horror: new Set(["Wholesome", "Family Friendly", "Cute", "Relaxing", "Cozy"]),
  wholesome: new Set(["Horror", "Gore", "Violent", "Dark", "Psychological Horror"]),
  adult: new Set(["Family Friendly", "Wholesome", "Cute"]),
};

function hasVibeConflict(sourceTags: string[], suggestedTags: string[]): boolean {
  const sourceSet = new Set(sourceTags.map((t) => t.toLowerCase()));
  const suggestedSet = new Set(suggestedTags.map((t) => t.toLowerCase()));

  if (
    (sourceSet.has("horror") || sourceSet.has("psychological horror")) &&
    (suggestedSet.has("wholesome") || suggestedSet.has("family friendly"))
  ) {
    return true;
  }

  if (
    (sourceSet.has("wholesome") || sourceSet.has("family friendly")) &&
    (suggestedSet.has("horror") || suggestedSet.has("gore") || suggestedSet.has("psychological horror"))
  ) {
    return true;
  }

  return false;
}

export function calculateTagSimilarity(
  sourceTags: Record<string, number>,
  suggestedTags: Record<string, number>
): { score: number; sharedTags: string[]; vibeConflict: boolean } {
  const sourceTopTags = getTopTags(sourceTags, 15);
  const suggestedTopTags = getTopTags(suggestedTags, 15);

  if (sourceTopTags.length === 0 || suggestedTopTags.length === 0) {
    return { score: 0.5, sharedTags: [], vibeConflict: false };
  }

  const vibeConflict = hasVibeConflict(sourceTopTags, suggestedTopTags);

  const sourceSet = new Set(sourceTopTags.map((t) => t.toLowerCase()));
  const sharedTags: string[] = [];

  for (const tag of suggestedTopTags) {
    if (sourceSet.has(tag.toLowerCase())) {
      sharedTags.push(tag);
    }
  }

  const minTags = Math.min(sourceTopTags.length, suggestedTopTags.length);
  const score = minTags > 0 ? sharedTags.length / minTags : 0;

  return { score, sharedTags, vibeConflict };
}

export type TagValidationResult = {
  valid: boolean;
  score: number;
  sharedTags: string[];
  vibeConflict: boolean;
  reason?: string;
};

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

export async function validateSuggestionByTags(
  sourceAppId: number,
  suggestedAppId: number,
  minScore = 0.15
): Promise<TagValidationResult> {
  const [sourceData, suggestedData] = await Promise.all([
    fetchSteamSpyData(sourceAppId),
    fetchSteamSpyData(suggestedAppId),
  ]);

  if (!sourceData || Object.keys(sourceData.tags).length === 0) {
    return { valid: true, score: 1, sharedTags: [], vibeConflict: false, reason: "Source has no tags, skipping validation" };
  }

  if (!suggestedData || Object.keys(suggestedData.tags).length === 0) {
    return { valid: true, score: 0.5, sharedTags: [], vibeConflict: false, reason: "Suggested game has no tags, allowing" };
  }

  const { score, sharedTags, vibeConflict } = calculateTagSimilarity(sourceData.tags, suggestedData.tags);

  if (vibeConflict) {
    return {
      valid: false,
      score,
      sharedTags,
      vibeConflict: true,
      reason: `Vibe conflict detected (e.g., horror vs wholesome)`,
    };
  }

  if (score < minScore) {
    return {
      valid: false,
      score,
      sharedTags,
      vibeConflict: false,
      reason: `Tag similarity too low: ${(score * 100).toFixed(0)}% < ${(minScore * 100).toFixed(0)}%`,
    };
  }

  return { valid: true, score, sharedTags, vibeConflict: false };
}
