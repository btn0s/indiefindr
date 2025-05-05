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
        <div className="relative -mt-16 mb-4 flex items-center justify-between">
          <div>
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
            {(gameData.desc || gameData.about_game || "").substring(0, 300)}
            {(gameData.desc || gameData.about_game || "").length > 300
              ? "..."
              : ""}
          </p>
        </div>

        {gameData.tags && gameData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gameData.tags.map((item, index) => (
              <Badge key={index} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        )}

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

        {(sourceSteamUrl ||
          (gameData.external_links && gameData.external_links.length > 0)) && (
          <div className="p-3 rounded-lg text-sm border border-green-500 bg-green-100">
            <h3 className="font-medium mb-2">Ways to Play</h3>
            <div className="grid grid-cols-1 gap-2">
              {sourceSteamUrl && (
                <Button
                  asChild
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Link
                    href={sourceSteamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaSteam className="mr-2 size-3" />
                    Play on Steam
                  </Link>
                </Button>
              )}

              {gameData.external_links
                ?.filter(
                  (link) =>
                    link.name.toLowerCase().includes("store") ||
                    link.name.toLowerCase().includes("play") ||
                    link.name.toLowerCase().includes("itch") ||
                    link.name.toLowerCase().includes("epic") ||
                    link.name.toLowerCase().includes("gog")
                )
                .map((link, index) => (
                  <Button
                    key={`platform-${index}`}
                    asChild
                    variant="outline"
                    className="border-green-500 hover:bg-green-200"
                  >
                    <Link
                      href={link.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon className="mr-2 size-3" />
                      {link.name.startsWith("play") ||
                      link.name.startsWith("Play")
                        ? link.name
                        : `Play on ${link.name}`}
                    </Link>
                  </Button>
                ))}
            </div>
          </div>
        )}

        {gameData.release_date && (
          <div className="bg-muted p-3 rounded-lg text-sm border ">
            <h3 className="font-medium mb-1">Release Info</h3>
            <p className="text-muted-foreground">{gameData.release_date}</p>
          </div>
        )}

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
