"use client";

import { Badge } from "./ui/badge";
import { useState } from "react";
import {
  type RapidApiGameData,
  type RapidApiExternalLink,
  type RapidApiPricing,
  type RapidApiReview,
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
import { Copy, ExternalLinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { FaSteam } from "react-icons/fa";
import { GameNewsSection } from "@/components/GameNewsSection";
import { GameReviewSentiment } from "./GameReviewSentiment";
import { ImageWithFallbacks } from "./ImageWithFallbacks";
import { RerunFormClient } from "./RerunFormClient";

interface IndieGameReportProps {
  id: number;
  gameData: RapidApiGameData;
  sourceSteamUrl: string | null;
  audienceAppeal: string | null;
  rawReviewJson?: RapidApiReview[] | null;
}

const getDisplayPrice = (
  pricing: RapidApiPricing[] | undefined | null
): string => {
  if (!pricing || pricing.length === 0) {
    return "N/A";
  }
  const basePriceObj =
    pricing.find(
      (p) =>
        p.name.toLowerCase().startsWith("buy ") ||
        p.name.toLowerCase().startsWith("play ")
    ) || pricing[0];

  if (basePriceObj?.price) {
    return basePriceObj.price;
  } else {
    return "N/A";
  }
};

export function IndieGameReport({
  id,
  gameData,
  sourceSteamUrl,
  audienceAppeal,
  rawReviewJson,
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

  // Calculate display price
  const displayPrice = getDisplayPrice(gameData.pricing);

  return (
    <div className="w-full relative mx-auto sm:border sm:rounded-xl overflow-hidden shadow-md bg-background">
      {process.env.NODE_ENV === "development" && (
        <div className="absolute top-4 flex gap-2 right-4 z-10 items-center">
          <span className="text-xs text-background font-bold">DEBUG</span>
          <RerunFormClient findId={id} sourceSteamUrl={sourceSteamUrl} />
          <Button
            onClick={copyJsonToClipboard}
            variant="secondary"
            size="sm"
            className="text-xs"
          >
            <Copy className="size-3" />
            {copyStatus || "Copy Raw JSON"}
          </Button>
        </div>
      )}
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
            {steamAppId && <GameReviewSentiment reviews={rawReviewJson} />}
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
            <div className="text-muted-foreground">{displayPrice}</div>
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
      </div>
    </div>
  );
}
