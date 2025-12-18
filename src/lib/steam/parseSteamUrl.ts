/**
 * Extract Steam AppID from various Steam URL formats
 */
export function parseSteamAppId(url: string): number | null {
  // Remove whitespace
  url = url.trim();

  // Handle direct appid
  const directMatch = url.match(/^\d+$/);
  if (directMatch) {
    return parseInt(directMatch[0], 10);
  }

  // Common Steam URL patterns:
  // https://store.steampowered.com/app/123456/GameName/
  // https://steamcommunity.com/app/123456
  // steam://run/123456
  // app/123456

  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/,
    /steamcommunity\.com\/app\/(\d+)/,
    /steam:\/\/run\/(\d+)/,
    /\/app\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Validate that a Steam URL can be parsed
 */
export function isValidSteamUrl(url: string): boolean {
  return parseSteamAppId(url) !== null;
}
