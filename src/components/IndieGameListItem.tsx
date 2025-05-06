import { DetailedIndieGameReport } from "@/schema";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  extractSteamAppId,
  findGameImage,
  getGameImageSources,
} from "@/lib/utils";
import {
  RapidApiGameData,
  RapidApiReview,
  RapidApiPricing,
} from "@/lib/rapidapi/types";
import { ImageWithFallbacks } from "./ImageWithFallbacks";
import { GameReviewSentiment } from "./GameReviewSentiment";
// Helper functions moved outside component for cleaner organization
// const extractSteamAppId = (url: string): string | null => {
//   const match = url.match(/store\\.steampowered\\.com\\/app\\/(\\d+)/i);
//   return match ? match[1] : null;
// };

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

interface GameFind {
  id: string | number;
  reportData: DetailedIndieGameReport;
  createdAt: Date | string;
  gameData?: RapidApiGameData; // Contains core data like pricing
  rawReviewJson?: RapidApiReview[] | null; // Add the raw review data
  audienceAppeal?: string | null;
}

interface IndieGameListItemProps {
  find: GameFind;
  showCreatedAt?: boolean;
}

export function IndieGameListItem({
  find,
  showCreatedAt = false,
}: IndieGameListItemProps) {
  const { reportData, createdAt, gameData, rawReviewJson, audienceAppeal } =
    find;

  // --- Updated steamAppId logic ---
  // Prioritize steamAppId from reportData, then fall back to link extraction
  const actualAppId = reportData.steamAppId
    ? reportData.steamAppId
    : (() => {
        const primaryLink = getPrimaryLink(reportData.relevantLinks);
        const steamAppIdFromLink = // Corrected variable name
          primaryLink?.type === "Steam" && primaryLink.url
            ? extractSteamAppId(primaryLink.url)
            : null;
        const demoAppIdFromLink = // Corrected variable name
          primaryLink?.type === "Steam Demo" && primaryLink.url
            ? extractSteamAppId(primaryLink.url)
            : null;
        return steamAppIdFromLink || demoAppIdFromLink;
      })();
  // --- End updated logic ---

  // Use game data sources if available
  let imageSources: string[] = [];

  if (gameData) {
    // If we have full game data, use the utility function
    imageSources = getGameImageSources(gameData, actualAppId);
  } else {
    // Fall back to just the Steam image
    const coverArtImage = findGameImage(actualAppId);
    if (coverArtImage) imageSources.push(coverArtImage);
  }

  // Format the creation date if it exists and is requested
  const formattedDate =
    showCreatedAt && createdAt
      ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
      : null;

  // --- Optional: Extract Pricing Info ---
  let displayPrice: string | null = null;
  if (gameData?.pricing && gameData.pricing.length > 0) {
    const basePriceObj =
      gameData.pricing.find(
        (p) =>
          p.name.toLowerCase().startsWith("buy ") ||
          p.name.toLowerCase().startsWith("play ")
      ) || gameData.pricing[0];

    if (basePriceObj?.price) {
      displayPrice = basePriceObj.price; // e.g., "$14.99" or "Free To Play"
    }
  }

  return (
    <div className="flex relative flex-col sm:items-center sm:flex-row gap-3 sm:gap-4 p-3 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 bg-white w-full">
      {/* Game Cover Art - Updated for responsiveness */}
      <div className="flex-shrink-0 w-full sm:w-1/2 sm:max-w-1/2 aspect-cover-art rounded bg-gray-100 overflow-hidden border border-gray-200 relative">
        {imageSources.length > 0 ? (
          <ImageWithFallbacks
            sources={imageSources}
            alt={reportData.gameName || "Game cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-200 text-muted-foreground text-xs font-bold">
            {reportData.gameName ? reportData.gameName.charAt(0) : "G"}
          </div>
        )}
      </div>

      {/* Game Info - Ensure it takes full width when stacked */}
      <div className="flex-grow min-w-0 flex flex-col gap-2 items-start w-full">
        <div className="flex justify-between w-full">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold truncate">
              {reportData.gameName || "Untitled Game"}
            </h3>
            <p className="text-xs text-muted-foreground truncate mb-1">
              by {reportData.developerName || "Unknown Developer"}
            </p>
            {/* Pass rawReviewJson to GameReviewSentiment */}
            {actualAppId && (
              <div className="flex gap-2 items-center absolute top-2 right-2">
                <GameReviewSentiment reviews={rawReviewJson} />
              </div>
            )}
          </div>
          {formattedDate && (
            <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {formattedDate}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          {reportData.gameDescription}
        </p>
        {reportData.genresAndTags && reportData.genresAndTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reportData.genresAndTags.slice(0, 2).map((item, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs px-1.5 py-0.5"
              >
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
