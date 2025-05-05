import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DetailedIndieGameReport } from "@/schema";

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

// Helper function to group links by type
export const groupLinksByType = (
  links: DetailedIndieGameReport["relevantLinks"]
) => {
  if (!links) return {};
  return links.reduce((acc, link) => {
    if (!link || !link.type || !link.url) return acc;
    const type = link.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(link);
    return acc;
  }, {} as { [key: string]: typeof links });
};

// --- Image Resolvers (Extracted from IndieGameReport) ---

export const findGameImage = (steamAppId: string | null): string | null => {
  if (steamAppId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;
  }
  return null;
};

// Find background image - prefer screenshots, then header, then key art, etc.
export const findGameBackgroundImage = (
  reportData: DetailedIndieGameReport,
  steamAppId: string | null
): string | null => {
  // 1. Screenshot
  const screenshot = reportData.relevantLinks?.find(
    (link) => link.type === "Screenshot"
  )?.url;
  if (screenshot) return screenshot;

  // 2. Steam Header (using the helper)
  const steamHeader = findGameImage(steamAppId);
  if (steamHeader) return steamHeader;

  // 3. Key Art
  const keyArt = reportData.relevantLinks?.find(
    (link) => link.type === "Key Art"
  )?.url;
  if (keyArt) return keyArt;

  // 4. Trailer Thumbnail
  const trailerThumb = reportData.relevantLinks?.find(
    (link) => link.type === "Trailer Thumbnail"
  )?.url;
  if (trailerThumb) return trailerThumb;

  // 5. Fallback (currently null, could potentially check other link types)
  return null;
};
