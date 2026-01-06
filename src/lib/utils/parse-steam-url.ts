/**
 * Parse Steam URL to extract AppID
 * Supports formats:
 * - https://store.steampowered.com/app/123456/GameName/
 * - https://steamcommunity.com/app/123456
 * - store.steampowered.com/app/123456
 * - Just a number (treated as AppID)
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
