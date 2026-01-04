"use client";

import { track } from "@vercel/analytics";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SteamButtonProps = {
  appid: string;
  title: string;
};

export function SteamButton({ appid, title }: SteamButtonProps) {
  const handleSteamClick = () => {
    track("steam_page_click", {
      appid,
      title,
    });
  };

  return (
    <Button className="w-fit mt-1 sm:mt-0" size="sm" variant="retro">
      <a
        href={`https://store.steampowered.com/app/${appid}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1"
        onClick={handleSteamClick}
      >
        <span className="hidden sm:inline">View on Steam</span>
        <span className="sm:hidden">Steam</span>
        <ArrowUpRight className="size-3" />
      </a>
    </Button>
  );
}
