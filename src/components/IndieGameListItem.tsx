import { DetailedIndieGameReport } from "@/schema";
import { Badge } from "./ui/badge";

// Helper to extract Steam App ID from a Steam URL
const extractSteamAppId = (url: string): string | null => {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i);
  return match ? match[1] : null;
};

// Helper function to group links by type (simplified for list item)
const getPrimaryLink = (links: DetailedIndieGameReport["relevantLinks"]) => {
  if (!links) return null;
  // Prioritize Steam, then Itch.io, then Kickstarter
  const steamLink = links.find((link) => link?.type === "Steam");
  if (steamLink) return { type: "Steam", url: steamLink.url };
  const itchLink = links.find((link) => link?.type === "Itch.io");
  if (itchLink) return { type: "Itch.io", url: itchLink.url };
  const kickstarterLink = links.find((link) => link?.type === "Kickstarter");
  if (kickstarterLink) return { type: "Kickstarter", url: kickstarterLink.url };
  const demoLink = links.find((link) => link?.type === "Steam Demo");
  if (demoLink) return { type: "Steam Demo", url: demoLink.url };
  // Fallback to the first available link if none of the preferred types are found
  return links[0] ? { type: links[0].type, url: links[0].url } : null;
};

interface IndieGameListItemProps {
  reportData: DetailedIndieGameReport;
}

export function IndieGameListItem({ reportData }: IndieGameListItemProps) {
  const primaryLink = getPrimaryLink(reportData.relevantLinks);
  const steamAppId =
    primaryLink?.type === "Steam" && primaryLink.url
      ? extractSteamAppId(primaryLink.url)
      : null;
  const demoAppId =
    primaryLink?.type === "Steam Demo" && primaryLink.url
      ? extractSteamAppId(primaryLink.url)
      : null;
  const actualAppId = steamAppId || demoAppId;

  // Find the appropriate Steam cover art for the tile
  const findCoverArtImage = () => {
    const coverArt = reportData.relevantLinks?.find(
      (link) => link.type === "Cover Art"
    )?.url;
    if (coverArt) return coverArt;

    const keyArt = reportData.relevantLinks?.find(
      (link) => link.type === "Key Art"
    )?.url;
    if (keyArt) return keyArt;

    // If we have a Steam App ID, construct the cover image URL
    if (actualAppId) {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${actualAppId}/capsule_231x87.jpg`; // Smaller capsule
    }

    const screenshot = reportData.relevantLinks?.find(
      (link) => link.type === "Screenshot"
    )?.url;
    if (screenshot) return screenshot;

    return null;
  };

  const coverArtImage = findCoverArtImage();
  const hasDemo = reportData.relevantLinks?.some(
    (link) => link?.type === "Steam Demo"
  );

  return (
    <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 bg-white w-full max-w-md mx-auto">
      {/* Game Cover Art (Smaller) */}
      <div className="flex-shrink-0 w-[100px] h-[45px] rounded bg-gray-100 overflow-hidden border border-gray-200 relative">
        {coverArtImage ? (
          <img
            src={coverArtImage}
            alt={reportData.gameName || "Game cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-200 text-gray-500 text-xs font-bold">
            {reportData.gameName ? reportData.gameName.charAt(0) : "G"}
          </div>
        )}
        {reportData.releaseInfo?.toLowerCase().includes("2024") && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] px-1 py-0 rounded-full font-medium leading-none">
            NEW
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="flex-grow min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {reportData.gameName || "Untitled Game"}
        </h3>
        <p className="text-xs text-gray-500 truncate">
          by {reportData.developerName || "Unknown Developer"}
        </p>
        {/* Optional: Display a few key tags */}
        {reportData.genresAndTags && reportData.genresAndTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reportData.genresAndTags.slice(0, 2).map(
              (
                item,
                index // Show only first 2 tags
              ) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs px-1.5 py-0.5"
                >
                  {item}
                </Badge>
              )
            )}
          </div>
        )}
      </div>

      {/* Action Button / Link */}
      <div className="flex-shrink-0">
        {primaryLink?.url ? (
          <a
            href={primaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white ${
              primaryLink.type === "Steam"
                ? "bg-[#1b2838] hover:bg-[#2a475e]"
                : primaryLink.type === "Itch.io"
                ? "bg-[#fa5c5c] hover:bg-[#f53333]"
                : primaryLink.type === "Kickstarter"
                ? "bg-[#05ce78] hover:bg-[#04a460]"
                : primaryLink.type === "Steam Demo"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {primaryLink.type === "Steam Demo"
              ? "Demo"
              : primaryLink.type || "View"}
            {/* Optional: Add an external link icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        ) : hasDemo ? (
          <Badge className="bg-green-600 text-green-50 text-xs px-1.5 py-0.5">
            Demo
          </Badge>
        ) : (
          // Placeholder if no link is available
          <span className="text-xs text-gray-400">No Link</span>
        )}
      </div>
    </div>
  );
}
