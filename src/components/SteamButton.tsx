"use client";

import { track } from "@vercel/analytics";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

type SteamButtonProps = {
  appid: string;
  title: string;
};

export function SteamButton({ appid, title }: SteamButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
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
      className={`cartridge-action-button inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#000000] ${isPressed ? "cartridge-button-pressed" : ""}`}
      onClick={handleSteamClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <span className="hidden sm:inline">VIEW ON STEAM</span>
      <span className="sm:hidden">STEAM</span>
      <ArrowUpRight className="size-3.5" />
    </a>
  );
}
