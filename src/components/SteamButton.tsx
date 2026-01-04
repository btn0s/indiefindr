"use client";

import { track } from "@vercel/analytics";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <a
      href={`https://store.steampowered.com/app/${appid}/`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ size: "sm", variant: "default" }),
        "w-fit mt-1 sm:mt-0"
      )}
      onClick={handleSteamClick}
    >
      <span className="hidden sm:inline">View on Steam</span>
      <span className="sm:hidden">Steam</span>
      <ArrowUpRight className="size-3" />
    </a>
  );
}
