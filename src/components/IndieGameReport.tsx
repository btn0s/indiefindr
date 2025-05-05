"use client";

import { DetailedIndieGameReport } from "@/schema";
import { Badge } from "./ui/badge";
import { useState } from "react";
import {
  extractSteamAppId,
  groupLinksByType,
  findGameImage,
  findGameBackgroundImage,
} from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface IndieGameReportProps {
  reportData: DetailedIndieGameReport;
}

export function IndieGameReport({ reportData }: IndieGameReportProps) {
  const groupedLinks = groupLinksByType(reportData.relevantLinks);
  const [copyStatus, setCopyStatus] = useState<string>("");

  // Copy raw JSON to clipboard function
  const copyJsonToClipboard = () => {
    try {
      const jsonString = JSON.stringify(reportData, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (error) {
      setCopyStatus("Failed to copy");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  // Get Steam App ID - Prioritize from reportData, then calculate
  const getSteamAppId = (): string | null => {
    if (reportData.steamAppId) {
      return reportData.steamAppId;
    }
    // Fallback calculation if not in reportData
    if (groupedLinks["Steam"] && groupedLinks["Steam"][0]?.url) {
      return extractSteamAppId(groupedLinks["Steam"][0].url);
    }
    if (groupedLinks["Steam Demo"] && groupedLinks["Steam Demo"][0]?.url) {
      const demoUrl = groupedLinks["Steam Demo"][0].url;
      if (demoUrl.includes("store.steampowered.com")) {
        return extractSteamAppId(demoUrl);
      }
    }
    return null;
  };

  const steamAppId = getSteamAppId();
  const screenshots = groupedLinks["Screenshot"] || [];

  // Find the appropriate Steam cover art for the tile
  const coverArtImage = findGameImage(steamAppId);

  // Find background image - prefer screenshots over other types
  const backgroundImage = findGameBackgroundImage(reportData, steamAppId);

  return (
    <div className="w-full mx-auto border border-gray-200 rounded-xl overflow-hidden shadow-md bg-white">
      {/* Header with navigational elements - could be removed or replaced for actual integration */}
      <div className="relative">
        {/* Back button - for UI consistency */}
        {/* <button className="absolute top-4 left-4 z-10 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-700"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button> */}

        {/* More actions button */}
        {/* <button className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-700"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button> */}

        {/* Background Image with blur effects */}
        <div className="w-full h-[150px] relative">
          {backgroundImage ? (
            <div className="w-full h-full relative">
              <img
                src={backgroundImage}
                alt={reportData.gameName || "Game image"}
                className="w-full h-full object-cover blur-md opacity-80"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-indigo-500/90 to-purple-700/90"></div>
          )}
        </div>
      </div>

      {/* Game info section */}
      <div className="px-4 pt-2 pb-4 relative">
        {/* Game logo/icon - updated to match Steam capsule aspect ratio (616x353) */}
        <div className="flex justify-between items-start -mt-8 mb-3">
          <div className="relative">
            <div className="aspect-cover-art w-[200px] rounded-lg border-4 border-white bg-gray-100 overflow-hidden shadow-lg">
              {/* Use Steam cover art if available, otherwise fall back to first letter */}
              {coverArtImage ? (
                <img
                  src={coverArtImage}
                  alt={reportData.gameName || "Game cover"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-800 text-white text-sm font-bold">
                  {reportData.gameName ? reportData.gameName.charAt(0) : "G"}
                </div>
              )}
            </div>
            {/* New badge if recently released */}
            {reportData.releaseInfo?.toLowerCase().includes("2024") && (
              <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                NEW
              </div>
            )}
          </div>
        </div>

        {/* Game name and developer */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {reportData.gameName || "Untitled Game"}
          </h1>
          <p className="text-gray-600">
            by{" "}
            <span className="font-medium">
              {reportData.developerName || "Unknown Developer"}
            </span>
            {reportData.publisherName && (
              <span className="text-gray-500">
                {" "}
                • Published by {reportData.publisherName}
              </span>
            )}
          </p>
        </div>

        {/* Game description */}
        <div className="mb-4">
          <p className="text-gray-700 text-sm">
            {reportData.gameDescription?.substring(0, 300)}
            {reportData.gameDescription &&
            reportData.gameDescription.length > 300
              ? "..."
              : ""}
          </p>
        </div>

        {/* Steam & Demo links (prioritized) */}
        {(groupedLinks["Steam"] ||
          groupedLinks["Steam Demo"] ||
          groupedLinks["Itch.io"]) && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100 mb-4 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-gray-900 leading-none">
                Play or Wishlist
              </h3>
              {groupedLinks["Steam Demo"] && (
                <Badge className="bg-green-600 text-green-50">
                  Demo Available
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {groupedLinks["Steam"]?.map((link, index) => (
                <a
                  key={`steam-${index}`}
                  href={link?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#1b2838] text-white px-3 py-1.5 rounded-md text-sm font-medium"
                >
                  Steam Page
                </a>
              ))}
              {groupedLinks["Itch.io"]?.map((link, index) => (
                <a
                  key={`itch-${index}`}
                  href={link?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#fa5c5c] text-white px-3 py-1.5 rounded-md text-sm font-medium"
                >
                  Itch.io
                </a>
              ))}
              {groupedLinks["Kickstarter"]?.map((link, index) => (
                <a
                  key={`kickstarter-${index}`}
                  href={link?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#05ce78] text-white px-3 py-1.5 rounded-md text-sm font-medium"
                >
                  Kickstarter
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI confidence assessment */}
        {/* {reportData.aiConfidenceAssessment && (
          <div className="mb-4 bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-800">
            <div className="font-medium mb-0.5">AI Report Confidence</div>
            <p>{reportData.aiConfidenceAssessment}</p>
          </div>
        )} */}

        {/* Tags/Genres */}
        {reportData.genresAndTags && reportData.genresAndTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {reportData.genresAndTags.map((item, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-xs font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Screenshots Carousel */}
        {screenshots.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Screenshots</h3>
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full max-w-full"
            >
              <CarouselContent className="-ml-2">
                {screenshots.map((link, index) => (
                  <CarouselItem
                    key={`screenshot-${index}`}
                    className="pl-2 md:basis-1/2 lg:basis-1/3"
                  >
                    <div className="aspect-video overflow-hidden rounded-lg border border-gray-200">
                      <img
                        src={link?.url || ""}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4 top-1/2 -translate-y-1/2" />
              <CarouselNext className="-right-4 top-1/2 -translate-y-1/2" />
            </Carousel>
          </div>
        )}

        {/* Main content sections */}
        <div className="space-y-4">
          {/* Release info */}
          {reportData.releaseInfo && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-1">Release Info</h3>
              <p className="text-gray-700">{reportData.releaseInfo}</p>
            </div>
          )}

          {/* Developer info & funding */}
          {(reportData.developerBackground || reportData.fundingInfo) && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">
                About the Developer
              </h3>
              <div className="space-y-3 text-sm text-gray-700">
                {reportData.developerBackground && (
                  <div>
                    <p>{reportData.developerBackground}</p>
                  </div>
                )}
                {reportData.fundingInfo && (
                  <div>
                    <h4 className="font-medium text-gray-800">Funding</h4>
                    <p>{reportData.fundingInfo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team members */}
          {reportData.teamMembers && reportData.teamMembers.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">
                Development Team
              </h3>
              <ul className="divide-y divide-gray-100 text-sm">
                {reportData.teamMembers.map((member, index) => (
                  <li key={index} className="py-1.5 flex justify-between">
                    <span className="font-semibold">
                      {member.name || "N/A"}
                    </span>
                    <span className="text-gray-500">
                      {member.role || "N/A"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All other links */}
          {Object.keys(groupedLinks).length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">
                Links & Resources
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(groupedLinks)
                  .filter(
                    ([type]) =>
                      ![
                        "Steam",
                        "Steam Demo",
                        "Itch.io",
                        "Kickstarter",
                      ].includes(type)
                  )
                  .map(([type, links]) => (
                    <a
                      key={type}
                      href={(links as any)[0]?.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm flex items-center"
                    >
                      {type}
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* Source data (hidden in collapsible) */}
          <details className="mt-4 text-xs border-t pt-2">
            <summary className="font-medium text-gray-500 cursor-pointer">
              Developer Data & Notes
            </summary>

            {reportData.overallReportSummary && (
              <div className="mt-2">
                <h3 className="font-medium text-gray-500">Report Summary:</h3>
                <p className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-gray-600">
                  {reportData.overallReportSummary}
                </p>
              </div>
            )}

            {/* Copy Raw JSON button */}
            <button
              onClick={copyJsonToClipboard}
              className="mt-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {copyStatus || "Copy Raw JSON"}
            </button>
          </details>
        </div>
      </div>
    </div>
  );
}
