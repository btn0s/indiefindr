import Image from "next/image";
import { isRescued, type ReviewQuality } from "@/lib/review-quality";
import { heroImage, type HeroFields } from "@/lib/hero";
import { CardRating } from "./Rating";
import { CardLink, CardMorph } from "./CardLink";

export interface GameCardProps extends ReviewQuality, HeroFields {
  appid: number;
  title: string;
  review_count?: number;
  review_positive_pct?: number | null;
  /** On the first screen: fetch the art with the page instead of lazily, and the game page without waiting for intent. */
  preload?: boolean;
  /** 1-based place in its list, for click and impression tracking (CardTracker); 0 when the order means nothing. */
  position?: number;
}

/** Renders on the server; only the link (prefetch and intent) and the morph names are client code. */
export function GameCard({
  appid, title, header_image, hero_poster, hero_still,
  review_count = 0, review_positive_pct = null, clean_score, bomb_windows,
  preload = false, position = 0,
}: GameCardProps) {
  return (
    <CardLink appid={appid} hero={heroImage({ hero_poster, hero_still, header_image })} eager={preload} className="game-card"
      data-appid={appid} data-position={position}>
      <div>
        <CardMorph part="art" appid={appid}>
          <div className="game-card-art">
            {header_image && <Image src={header_image} alt={title} fill unoptimized className="object-cover" preload={preload} />}
          </div>
        </CardMorph>
        <CardMorph part="title" appid={appid}><div className="game-card-title"><span>{title}</span></div></CardMorph>
        <CardRating pct={review_positive_pct} count={review_count} rescued={isRescued({ review_positive_pct, review_count, clean_score, bomb_windows })} />
      </div>
    </CardLink>
  );
}
