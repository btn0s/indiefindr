import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to extract Steam App ID from a Steam URL
export const extractSteamAppId = (url: string): string | null => {
  // Regex now matches both store.steampowered.com/app/ID and s.team/a/ID
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)|s\.team\/a\/(\d+)/i);
  // Return the ID from whichever capture group matched
  return match ? match[1] || match[2] : null;
};
