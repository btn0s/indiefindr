import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RapidApiGameData } from "@/lib/rapidapi/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to extract Steam App ID from a Steam URL
export const extractSteamAppId = (url: string): string | null => {
  // Regex now matches both store.steampowered.com/app/ID and s.team/a/ID
  const match = url.match(
    /store\.steampowered\.com\/app\/(\d+)|s\.team\/a\/(\d+)/i
  );
  // Return the ID from whichever capture group matched
  return match ? match[1] || match[2] : null;
};

// --- Image Resolvers (Extracted from IndieGameReport) ---

export const findGameImage = (steamAppId: string | null): string | null => {
  if (steamAppId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;
  }
  return null;
};

// Find background image - prefer screenshots, then header.
export const findGameBackgroundImage = (
  gameData: RapidApiGameData,
  steamAppId: string | null
): string | null => {
  // 1. Use first screenshot from media object if available
  const screenshot = gameData.media?.screenshot?.[0];
  if (screenshot) return screenshot;

  // 2. Steam Header (using the helper)
  const steamHeader = findGameImage(steamAppId);
  if (steamHeader) return steamHeader;

  // 3. Key Art - Removed as it relied on relevantLinks

  // 4. Trailer Thumbnail - Removed as it relied on relevantLinks

  // Fallback to null
  return null;
};

// Get all game images in order of priority (for fallback chains)
export const getGameImageSources = (
  gameData: RapidApiGameData,
  steamAppId: string | null
): string[] => {
  const sources: string[] = [];
  
  // 1. Add Steam header if available
  const steamHeader = findGameImage(steamAppId);
  if (steamHeader) sources.push(steamHeader);
  
  // 2. Add first screenshot if available
  if (gameData.media?.screenshot?.length > 0) {
    sources.push(gameData.media.screenshot[0]);
  }
  
  // 3. Add any other screenshots
  if (gameData.media?.screenshot?.length > 1) {
    gameData.media.screenshot.slice(1).forEach(screenshot => {
      sources.push(screenshot);
    });
  }
  
  return sources;
};
