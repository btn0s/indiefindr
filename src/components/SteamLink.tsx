'use client';
import { track } from '@/lib/tracking';
export function SteamLink({appid}:{appid:number}){return <a className="underline font-semibold" href={`https://store.steampowered.com/app/${appid}/?utm_source=indiefindr&utm_medium=referral&utm_campaign=games_like`} target="_blank" rel="noopener noreferrer" onClick={()=>track('click_steam',appid,appid)}>View on Steam ↗</a>;}
