import Image from "next/image";
import { heroImage, type HeroFields } from "@/lib/hero";
import { CardRating } from "./Rating";
import { CardLink } from "./CardLink";

export interface GameCardProps extends HeroFields {
  appid: number;
  title: string;
  /** Steam's 600×900 library box art; null when the game has none. */
  cover?: string | null;
  review_count?: number;
  review_positive_pct?: number | null;
  /** On the first screen: fetch the art with the page instead of lazily. */
  preload?: boolean;
  /** 1-based place in its list, for click and impression tracking (CardTracker); 0 when the order means nothing. */
  position?: number;
}

/** How wide a cover draws: a third of a phone, a sixth of the 1040px column. The 600px file goes through the image
 *  optimizer, which serves the 384px size to both. */
const COVER_SIZES = "(min-width: 1096px) 160px, (min-width: 768px) 16vw, 32vw";

/** A game as its box art, with its name and rating set quietly under it. Renders on the server; only the link
 *  (prefetch and intent) is client code. */
export function GameCard({
  appid, title, cover = null, header_image, hero, hero_poster, hero_still,
  review_count = 0, review_positive_pct = null,
  preload = false, position = 0,
}: GameCardProps) {
  return (
    <CardLink appid={appid} hero={heroImage({ hero, hero_poster, hero_still, header_image })} className="game-card"
      data-appid={appid} data-position={position}>
      <div>
        <div className="game-card-art"><Cover title={title} cover={cover} header={header_image} sizes={COVER_SIZES} preload={preload} /></div>
        <p className="game-card-title">{title}</p>
        <CardRating pct={review_positive_pct} count={review_count} />
      </div>
    </CardLink>
  );
}

/** A game's box art, filling its 2:3 frame. A game with none gets a plain stand-in: its store header on the frame's
 *  neutral ground, with its name under it. */
export function Cover({ title, cover, header, sizes, preload = false }: {
  title: string; cover: string | null; header: string | null; sizes: string; preload?: boolean;
}) {
  if (cover) return <Image src={cover} alt={title} fill sizes={sizes} className="object-cover" preload={preload} />;
  return <span className="cover-stand-in">
    {header && <span className="cover-stand-in-art"><Image src={header} alt="" fill unoptimized className="object-cover" preload={preload} /></span>}
    <span className="cover-stand-in-title">{title}</span>
  </span>;
}
