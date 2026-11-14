import Image from "next/image";
import type { CardGame } from "@/lib/catalog";
import { heroImage } from "@/lib/hero";
import { ArtMark } from "./ArtMark";
import { CardLink } from "./CardLink";
import { GameplayLoop } from "./GameplayLoop";
import { CardRating } from "./Rating";

// How wide a cover renders: most of a phone, about 60% of a tablet; on desktop the large card or one of the pair.
const COVER_SIZES = ["(max-width: 639px) 90vw, (max-width: 999px) 60vw, 740px", "(max-width: 639px) 90vw, (max-width: 999px) 60vw, 380px"];

export type Feature = {
  appid: number;
  title: string;
  /** Wide art without the store header's baked-in logo, and the game page's hero (warmed when the visitor is about to
   *  open the card): the first screenshot, else the trailer's poster. */
  cover: string | null;
  /** Its gameplay clip, played over the cover while the card is on screen. */
  clip: string | null;
  /** Its first recommendations. */
  recs: CardGame[];
};

/** Home's opening: one large card per featured game, its art with the name over it and its first recommendations
 *  beneath. A row that scrolls and snaps on phones; on desktop one large card beside a pair (globals.css). The cover is
 *  a screenshot rather than the trailer's poster, which often carries the logo, so the name over it never doubles. Over
 *  it the game's gameplay clip plays while most of the card is on screen: on phones the card snapped into view, on
 *  desktop all three. */
export function FeatureCards({ features }: { features: Feature[] }) {
  if (!features.length) return null;
  return <section className="features" aria-label="Featured games">
    <ul className="feature-row">
      {features.map((feature, index) => <li key={feature.appid} className="feature">
        <CardLink appid={feature.appid} hero={feature.cover} className="feature-cover">
          <ArtMark />
          {feature.cover && <Image src={feature.cover} alt="" fill sizes={COVER_SIZES[index ? 1 : 0]} preload={index === 0} className="object-cover" suppressHydrationWarning />}
          {feature.clip && <GameplayLoop src={feature.clip} threshold={0.6} />}
          <span className="feature-name"><span className="feature-lead">Games like</span> <span className="feature-title">{feature.title}</span></span>
        </CardLink>
        <ol className="feature-recs" aria-label={`Games like ${feature.title}`}>
          {feature.recs.map(game => <li key={game.appid}>
            <CardLink appid={game.appid} hero={heroImage(game)} className="feature-rec">
              <span className="feature-rec-art">
                <ArtMark />
                {game.header_image && <Image src={game.header_image} alt={game.title} fill unoptimized className="object-cover" loading={index === 0 ? "eager" : "lazy"} suppressHydrationWarning />}
              </span>
              <div className="feature-rec-text">
                <span className="feature-rec-title">{game.title}</span>
                <CardRating pct={game.review_positive_pct} count={game.review_count} />
              </div>
            </CardLink>
          </li>)}
        </ol>
      </li>)}
    </ul>
  </section>;
}
