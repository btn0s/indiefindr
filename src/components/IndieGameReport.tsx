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
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { FaSteam } from "react-icons/fa";
import { GameNewsSection } from "@/components/GameNewsSection";

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

  return (
    <div className="w-full mx-auto border rounded-xl overflow-hidden shadow-md bg-background">
      <div className="w-full h-[150px] relative">
        {backgroundImage ? (
          <div className="w-full h-full relative">
            <img
              src={backgroundImage}
              alt={gameData.name || "Game image"}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-indigo-500/90 to-purple-700/90"></div>
        )}
        <div className="absolute inset-0 bg-foreground/50"></div>
      </div>

      <div className="px-4 pb-4 relative flex flex-col gap-4">
        <div className="relative -mt-16 flex items-center justify-between">
          <div>
            <div className="aspect-cover-art w-[200px] rounded-lg border-4 border-white bg-gray-100 overflow-hidden shadow">
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
                className="bg-background/30 backdrop-blur-sm text-background hover:bg-background/50"
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
          <h1 className="text-2xl font-bold">
            {gameData.name || "Untitled Game"}
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

        <div className="">
          <p className="text-muted-foreground text-sm">
            {gameData.desc || gameData.about_game || ""}
          </p>
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
              {gameData.pricing?.find((p) =>
                p.name.toLowerCase().includes("play")
              )?.price ||
                gameData.pricing?.[0]?.price ||
                "N/A"}
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
                      <DialogContent className="p-0 border-none !max-w-[80vw]">
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

        <div className="space-y-4">
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
