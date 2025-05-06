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
  getGameImageSources,
} from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { FaSteam } from "react-icons/fa";
import { GameNewsSection } from "@/components/GameNewsSection";
import { GamePriceDisplay } from "./GamePriceDisplay";
import { GameReviewSentiment } from "./GameReviewSentiment";
import { ImageWithFallbacks } from "./ImageWithFallbacks";

interface IndieGameReportProps {
  gameData: RapidApiGameData;
  sourceSteamUrl: string | null;
  audienceAppeal: string | null;
}

export function IndieGameReport({
  gameData,
  sourceSteamUrl,
  audienceAppeal,
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

  // Get all image sources in priority order
  const imageSources = getGameImageSources(gameData, steamAppId);

  // For backward compatibility
  const coverArtImage = imageSources.length > 0 ? imageSources[0] : null;
  const backgroundImage = findGameBackgroundImage(gameData, steamAppId);

  return (
    <div className="w-full mx-auto border rounded-xl overflow-hidden shadow-md bg-background">
      <div className="w-full h-[150px] relative">
        {imageSources.length > 0 ? (
          <ImageWithFallbacks
            sources={imageSources}
            alt={gameData.name || "Game background"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-indigo-500/90 to-purple-700/90"></div>
        )}
        <div className="absolute inset-0 bg-foreground/50"></div>
      </div>

      <div className="px-4 pb-4 relative flex flex-col gap-4">
        <div className="relative -mt-16 flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
          <div>
            <div className="aspect-cover-art w-[200px] rounded-lg border-4 border-white bg-gray-100 overflow-hidden shadow">
              {imageSources.length > 0 ? (
                <ImageWithFallbacks
                  sources={imageSources}
                  alt={gameData.name || "Game cover"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-800 text-white text-sm font-bold">
                  {gameData.name ? gameData.name.charAt(0) : "G"}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            {[
              {
                name: "Steam",
                link: sourceSteamUrl,
              },
              ...gameData.external_links,
            ].map((link) => (
              <Button
                key={link?.name}
                variant="secondary"
                className="sm:bg-background/30 backdrop-blur-sm text-sm sm:text-background hover:bg-background/50"
                size="sm"
                asChild
              >
                <Link
                  href={link?.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="capitalize">{link?.name}</span>
                  <ExternalLinkIcon className="size-3" />
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {gameData.name || "Untitled Game"}
            {steamAppId && <GameReviewSentiment steamAppId={steamAppId} />}
          </h1>
          <p className="text-muted-foreground">
            by{" "}
            <span className="font-medium">
              {gameData.dev_details?.developer_name?.join(", ") ||
                "Unknown Developer"}
            </span>
            {gameData.dev_details?.publisher?.length > 0 && (
              <span className="opacity-70">
                {" "}
                • Published by {gameData.dev_details.publisher.join(", ")}
              </span>
            )}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm mb-2">
            {gameData.desc || gameData.about_game || ""}
          </p>

          {/* Moved Audience Appeal Section */}
          {audienceAppeal && (
            <div className="text-sm">
              <div className="font-medium text-foreground mb-2">
                You'll like this game if...
              </div>
              <div className="text-muted-foreground">{audienceAppeal}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted p-4 text-sm">
          <div>
            <div className="font-medium text-foreground">Release Date</div>
            <div className="text-muted-foreground">
              {gameData.release_date || "N/A"}
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground">Developer</div>
            <div className="text-muted-foreground truncate">
              {gameData.dev_details?.developer_name?.join(", ") || "Unknown"}
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground">Price</div>
            <div className="text-muted-foreground">
              <GamePriceDisplay
                initialPricing={gameData.pricing}
                gameName={gameData.name}
                steamAppId={steamAppId}
              />
            </div>
          </div>
          {gameData.dev_details?.publisher?.length > 0 && (
            <div>
              <div className="font-medium text-foreground">Publisher</div>
              <div className="text-muted-foreground truncate">
                {gameData.dev_details.publisher.join(", ") || "Unknown"}
              </div>
            </div>
          )}
          {gameData.tags && gameData.tags.length > 0 && (
            <div className="col-span-2 mt-2">
              <div className="font-medium text-foreground mb-1.5">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {gameData.tags.map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-background"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {screenshots.length > 0 && (
          <div className="">
            <h3 className="font-medium mb-2">Screenshots</h3>
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
                    <Dialog>
                      <DialogTrigger>
                        <div className="aspect-video overflow-hidden rounded-lg border bg-muted-foreground">
                          <img
                            src={screenshotUrl || ""}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="p-0 border-none rounded-lg overflow-hidden !max-w-[80vw]">
                        <DialogTitle className="sr-only">
                          {gameData.name} Screenshot {index + 1}
                        </DialogTitle>
                        <img
                          src={screenshotUrl || ""}
                          alt={`Screenshot ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </DialogContent>
                    </Dialog>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {screenshots.length > 1 && (
                <>
                  <CarouselPrevious className="-left-2 shadow-md top-1/2 -translate-y-1/2" />
                  <CarouselNext className="-right-2 shadow-md top-1/2 -translate-y-1/2" />
                </>
              )}
            </Carousel>
          </div>
        )}

        {steamAppId && <GameNewsSection steamAppId={steamAppId} />}

        {process.env.NODE_ENV === "development" && (
          <button
            onClick={copyJsonToClipboard}
            className="absolute top-2 right-4 w-fit px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors"
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
        )}
      </div>
    </div>
  );
}
