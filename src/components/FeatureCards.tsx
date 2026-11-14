import Image from "next/image";
import type { CardGame } from "@/lib/catalog";
import { heroImage, HERO_SIZES } from "@/lib/hero";
import { CardLink } from "./CardLink";
import { CardRating } from "./Rating";

export type Feature = {
  appid: number;
  title: string;
  /** The game page's own hero (trailer poster, else first screenshot): wide, logo-free art. */
  cover: string | null;
  /** Its first recommendations. */
  recs: CardGame[];
};

/** Home's opening: one large card per featured game, its art with the name over it and its first recommendations
 *  beneath. A row that scrolls and snaps on phones; on desktop one large card beside a pair (globals.css). The cover
 *  asks for the same file the game page's hero will, so opening it finds the art already loaded. */
export function FeatureCards({ features }: { features: Feature[] }) {
  if (!features.length) return null;
  return <section className="features" aria-label="Featured games">
    <ul className="feature-row">
      {features.map((feature, index) => <li key={feature.appid} className="feature">
        <CardLink appid={feature.appid} hero={feature.cover} className="feature-cover">
          {feature.cover && <Image src={feature.cover} alt="" fill sizes={HERO_SIZES} preload={index === 0} className="object-cover" />}
          <span className="feature-name"><span className="feature-lead">Games like</span> <span className="feature-title">{feature.title}</span></span>
        </CardLink>
        <ol className="feature-recs" aria-label={`Games like ${feature.title}`}>
          {feature.recs.map(game => <li key={game.appid}>
            <CardLink appid={game.appid} hero={heroImage(game)} className="feature-rec">
              <span className="feature-rec-art">
                {game.header_image && <Image src={game.header_image} alt={game.title} fill unoptimized className="object-cover" loading={index === 0 ? "eager" : "lazy"} />}
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
