import Image from "next/image";
import { HERO_SIZES } from "@/lib/hero";
import type { HeroLogo } from "@/lib/steam-art";

const EDGE = { start: "left", center: "center", end: "right" } as const;
const ROW = { start: "top", center: "center", end: "bottom" } as const;

/** The top of a game page: Steam's library hero, the game's key art made without any text on it, with the game's
 *  logo set over it where its developer placed it for the Steam library. A game with no library art opens on its first
 *  screenshot (or trailer poster, or store header) instead, and without the logo. */
export function GameHero({ title, art, logo }: { title: string; art: string | null; logo: HeroLogo | null }) {
  return <div className="game-hero">
    {art && <Image src={art} alt="" fill preload sizes={HERO_SIZES} className="object-cover" />}
    {logo && <span className="hero-logo" data-x={logo.x} data-y={logo.y}
      style={{ width: `${logo.width}%`, height: `${logo.height}%` }}>
      <Image src={logo.src} alt={title} fill sizes={`(max-width: 1096px) ${Math.ceil(logo.width)}vw, ${Math.ceil(logo.width * 10.4)}px`}
        style={{ objectFit: "contain", objectPosition: `${EDGE[logo.x]} ${ROW[logo.y]}` }} />
    </span>}
  </div>;
}
