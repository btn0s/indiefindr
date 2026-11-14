import Image from "next/image";
import { heroImage, type HeroFields } from "@/lib/hero";
import { CardRating } from "./Rating";
import { CardLink } from "./CardLink";
import { ArtMark } from "./ArtMark";

export interface GameCardProps extends HeroFields {
  appid: number;
  title: string;
  review_count?: number;
  review_positive_pct?: number | null;
  /** On the first screen: fetch the art with the page instead of lazily. */
  preload?: boolean;
  /** 1-based place in its list, for click and impression tracking (CardTracker); 0 when the order means nothing. */
  position?: number;
  /** Drawn as box art (home's shelf rails) instead of the 2.14:1 store header: the game's 2:3 cover, or, without one,
   *  its first screenshot cropped to 2:3 with its name set across the foot. */
  box?: boolean;
  /** The game's box art, where Steam has it (steam-art.ts). */
  cover?: string | null;
}

// A built cover crops a 16:9 screenshot to 2:3, so the picture is drawn about 2.7 times the card's width (globals.css
// sizes box cards: about 2.3 to a phone, 3.4 to a tablet, five to a desktop page).
const BUILT_COVER_SIZES = "(max-width: 639px) 100vw, (max-width: 999px) 75vw, 560px";

/** Renders on the server; only the link (prefetch and intent) is client code. */
export function GameCard({
  appid, title, header_image, hero_poster, hero_still,
  review_count = 0, review_positive_pct = null,
  preload = false, position = 0, box = false, cover = null,
}: GameCardProps) {
  const still = hero_still ?? header_image;
  return (
    <CardLink appid={appid} hero={heroImage({ hero_poster, hero_still, header_image })} className={box ? "game-card box" : "game-card"}
      data-appid={appid} data-position={position}>
      <div>
        <div className="game-card-art">
          <ArtMark />
          {!box ? header_image && <Image src={header_image} alt={title} fill unoptimized className="object-cover" preload={preload} suppressHydrationWarning />
            : cover ? <Image src={cover} alt={title} fill unoptimized className="object-cover" preload={preload} suppressHydrationWarning />
            : <>
              {still && <Image src={still} alt="" fill sizes={BUILT_COVER_SIZES} className="object-cover" preload={preload} suppressHydrationWarning />}
              <span className="cover-name" aria-hidden="true">{title}</span>
            </>}
        </div>
        <div className="game-card-title"><span>{title}</span></div>
        <CardRating pct={review_positive_pct} count={review_count} compact={box} />
      </div>
    </CardLink>
  );
}
