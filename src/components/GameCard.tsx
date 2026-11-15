import Image from "next/image";
import { heroImage, type HeroFields } from "@/lib/hero";
import { RatingChip } from "./Rating";
import { CardLink } from "./CardLink";
import { ArtMark } from "./ArtMark";

export interface GameCardProps extends HeroFields {
  appid: number;
  title: string;
  review_count?: number;
  review_positive_pct?: number | null;
  preload?: boolean;
  position?: number;
  box?: boolean;
  cover?: string | null;
}

const BUILT_COVER_SIZES = "(max-width: 639px) 100vw, (max-width: 999px) 75vw, 560px";

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
        <RatingChip pct={review_positive_pct} count={review_count} />
      </div>
    </CardLink>
  );
}
