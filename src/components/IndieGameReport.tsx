"use client";

import { Badge } from "./ui/badge";
import { useState } from "react";
import {
  type RapidApiGameData,
  type RapidApiExternalLink,
} from "@/lib/rapidapi/types";
import {
  extractSteamAppId,
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
  gameData: RapidApiGameData;
  sourceSteamUrl: string | null;
}

export function IndieGameReport({
  gameData,
  sourceSteamUrl,
}: IndieGameReportProps) {
  const steamAppId = sourceSteamUrl ? extractSteamAppId(sourceSteamUrl) : null;

  const [copyStatus, setCopyStatus] = useState<string>("");

  const copyJsonToClipboard = () => {
    try {
      const jsonString = JSON.stringify(gameData, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (error) {
      setCopyStatus("Failed to copy");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const screenshots = gameData.media?.screenshot || [];

  const coverArtImage = findGameImage(steamAppId);

  const backgroundImage = findGameBackgroundImage(gameData, steamAppId);

  const steamLink = gameData.external_links?.find((link) =>
    link.name?.toLowerCase().includes("steam")
  );
  const itchLink = gameData.external_links?.find((link) =>
    link.name?.toLowerCase().includes("itch.io")
  );
  const kickstarterLink = gameData.external_links?.find((link) =>
    link.name?.toLowerCase().includes("kickstarter")
  );

  const hasSteamDemo = false;

  const otherLinks =
    gameData.external_links?.filter(
      (link) =>
        !["steam", "itch.io", "kickstarter"].some((term) =>
          link.name?.toLowerCase().includes(term)
        )
    ) || [];

  return (
    <div className="w-full mx-auto border border-gray-200 rounded-xl overflow-hidden shadow-md bg-white">
      <div className="relative">
        <div className="w-full h-[150px] relative">
          {backgroundImage ? (
            <div className="w-full h-full relative">
              <img
                src={backgroundImage}
                alt={gameData.name || "Game image"}
                className="w-full h-full object-cover blur-md opacity-80"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-indigo-500/90 to-purple-700/90"></div>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-4 relative">
        <div className="flex justify-between items-start -mt-8 mb-3">
          <div className="relative">
            <div className="aspect-cover-art w-[200px] rounded-lg border-4 border-white bg-gray-100 overflow-hidden shadow-lg">
              {coverArtImage ? (
                <img
                  src={coverArtImage}
                  alt={gameData.name || "Game cover"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-800 text-white text-sm font-bold">
                  {gameData.name ? gameData.name.charAt(0) : "G"}
                </div>
              )}
            </div>
            {gameData.release_date?.includes("2024") && (
              <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                NEW
              </div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {gameData.name || "Untitled Game"}
          </h1>
          <p className="text-gray-600">
            by{" "}
            <span className="font-medium">
              {gameData.dev_details?.developer_name?.join(", ") ||
                "Unknown Developer"}
            </span>
            {gameData.dev_details?.publisher?.length > 0 && (
              <span className="text-gray-500">
                {" "}
                • Published by {gameData.dev_details.publisher.join(", ")}
              </span>
            )}
          </p>
        </div>

        <div className="mb-4">
          <p className="text-gray-700 text-sm">
            {(gameData.desc || gameData.about_game || "").substring(0, 300)}
            {(gameData.desc || gameData.about_game || "").length > 300
              ? "..."
              : ""}
          </p>
        </div>

        {(steamLink || itchLink || kickstarterLink || hasSteamDemo) && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100 mb-4 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-gray-900 leading-none">
                Play or Wishlist
              </h3>
              {hasSteamDemo && (
                <Badge className="bg-green-600 text-green-50">
                  Demo Available
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {steamLink && (
                <a
                  key={`steam-link`}
                  href={steamLink.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#1b2838] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#2a475e] transition-colors"
                >
                  Steam Page
                </a>
              )}
              {itchLink && (
                <a
                  key={`itch-link`}
                  href={itchLink.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#fa5c5c] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#f93d3d] transition-colors"
                >
                  Itch.io
                </a>
              )}
              {kickstarterLink && (
                <a
                  key={`kickstarter-link`}
                  href={kickstarterLink.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-[#05ce78] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#04a964] transition-colors"
                >
                  Kickstarter
                </a>
              )}
            </div>
          </div>
        )}

        {gameData.tags && gameData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {gameData.tags.map((item, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-xs font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {screenshots.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Screenshots</h3>
            <Carousel
              opts={{
                align: "start",
                loop: screenshots.length > 1,
              }}
              className="w-full max-w-full"
            >
              <CarouselContent className="-ml-2">
                {screenshots.map((screenshotUrl, index) => (
                  <CarouselItem
                    key={`screenshot-${index}`}
                    className="pl-2 md:basis-1/2 lg:basis-1/3"
                  >
                    <div className="aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img
                        src={screenshotUrl || ""}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {screenshots.length > 1 && (
                <>
                  <CarouselPrevious className="-left-4 top-1/2 -translate-y-1/2" />
                  <CarouselNext className="-right-4 top-1/2 -translate-y-1/2" />
                </>
              )}
            </Carousel>
          </div>
        )}

        <div className="space-y-4">
          {gameData.release_date && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-1">Release Info</h3>
              <p className="text-gray-700">{gameData.release_date}</p>
            </div>
          )}

          {otherLinks.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">
                Other Links & Resources
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {otherLinks.map((link) => (
                  <a
                    key={link.name || link.link}
                    href={link.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 hover:underline text-sm truncate"
                    title={`${link.name}: ${link.link}`}
                  >
                    {link.name || "Link"}
                  </a>
                ))}
              </div>
            </div>
          )}

          <details className="mt-4 text-xs border-t pt-2">
            <summary className="font-medium text-gray-500 cursor-pointer">
              Developer Data & Notes
            </summary>

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
