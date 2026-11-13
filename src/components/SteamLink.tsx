'use client';
import { ArrowUpRight } from 'lucide-react';
import { track } from '@/lib/tracking';

/** "$19.99 on Steam" when the price is known, otherwise "View on Steam". */
export function SteamLink({ appid, price }: { appid: number; price: string | null }) {
  return <a className="steam-link" href={`https://store.steampowered.com/app/${appid}/?utm_source=indiefindr&utm_medium=referral&utm_campaign=games_like`}
    target="_blank" rel="noopener noreferrer" onClick={() => track('click_steam', appid, appid)}>
    {price ? `${price} on Steam` : "View on Steam"}<ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
  </a>;
}
