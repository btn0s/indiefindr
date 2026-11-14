import Image from "next/image";
import { heroImage, type HeroFields } from "@/lib/hero";
import { CardRating } from "./Rating";
import { CardLink } from "./CardLink";

export interface GameCardProps extends HeroFields {
  appid: number;
  title: string;
  review_count?: number;
  review_positive_pct?: number | null;
  /** On the first screen: fetch the art with the page instead of lazily. */
  preload?: boolean;
  /** 1-based place in its list, for click and impression tracking (CardTracker); 0 when the order means nothing. */
  position?: number;
}

/** Renders on the server; only the link (prefetch and intent) is client code. */
export function GameCard({
  appid, title, header_image, hero_poster, hero_still,
  review_count = 0, review_positive_pct = null,
  preload = false, position = 0,
}: GameCardProps) {
  return (
    <CardLink appid={appid} hero={heroImage({ hero_poster, hero_still, header_image })} className="game-card"
      data-appid={appid} data-position={position}>
      <div>
        <div className="game-card-art">
          {header_image && <Image src={header_image} alt={title} fill unoptimized className="object-cover" preload={preload} />}
        </div>
        <div className="game-card-title"><span>{title}</span></div>
        <CardRating pct={review_positive_pct} count={review_count} />
      </div>
    </CardLink>
  );
}
