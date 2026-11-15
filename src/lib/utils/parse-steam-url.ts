export function parseSteamUrl(url: string): number | null {
  let normalizedUrl = url.trim();

  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    normalizedUrl = "https://" + normalizedUrl;
  }

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

  const numericMatch = url.trim().match(/^\d+$/);
  if (numericMatch) {
    const appId = parseInt(numericMatch[0], 10);
    if (!isNaN(appId) && appId > 0) {
      return appId;
    }
  }

  return null;
}
