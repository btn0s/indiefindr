import Image, { getImageProps } from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { GameGrid } from "@/components/GameGrid";
import { getBrowsePage, getGame, getHomeShelves, getRecommendations, SHELVES, withArt, type CardGame, type ShelfSlug } from "@/lib/catalog";
import { Cover } from "@/components/GameCard";
import { ShelfHeading } from "@/components/ShelfHeading";
import { CardGrid } from "@/components/CardGrid";
import { EmptyNote } from "@/components/EmptyNote";

// Well-known indies whose pages show off the recommendations; one is featured per revalidation.
const SHOWCASE = [413150, 367520, 105600, 1145360, 504230, 646570];
// Any game works as a starting point, AAA included; recommendations are always indie.
const EXAMPLES = [[413150, "Stardew Valley"], [367520, "Hollow Knight"], [2379780, "Balatro"]] as const;

/** The featured game and its first recommendations, with their art. A new pick each time the cache refreshes, about
 *  once a minute. */
async function getShowcase() {
  "use cache";
  cacheLife("minutes");
  const appid = SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)];
  const [game, recs] = await Promise.all([getGame(appid), getRecommendations(appid)]);
  const [art, picks] = await Promise.all([withArt([{ appid }]), withArt(recs.slice(0, 3).map(rec => rec.game))]);
  return { game, hero: art[0].hero, recs: picks };
}

// The showcase sits beside the headline on desktop, about half the 1040px column; phones don't show it.
const SHOWCASE_SIZES = "(min-width: 1096px) 520px, 50vw";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/`;
  const title = "Find Your Next Favorite Indie Game — IndieFindr";
  const pageTitle = { absolute: title };
  const description =
    "Discover indie games on Steam. Search any game, get indie game recommendations, and find your next favorite.";
  const ogImageUrl = `${siteUrl}/og/home.png`;

  return {
    title: pageTitle,
    description,
    keywords: [
      "games like",
      "find games like",
      "similar games",
      "game recommendations",
      "indie game recommendations",
      "steam game recommendations",
      "discover indie games",
      "IndieFindr",
    ],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "IndieFindr game discovery",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function Home() {
  const games = await getBrowsePage(0);

  const [{ game: showcase, hero: showcaseHero, recs: showcaseRecs }, shelves] = await Promise.all([getShowcase(), getHomeShelves()]);
  // The source's key art, or its store header. Phones don't show the showcase, so the art is preloaded only where it
  // shows and the image itself is lazy (an image hidden by display: none is then never fetched).
  const showcaseArt = showcase && (showcaseHero ?? showcase.header_image);
  const showcasePreload = showcaseArt ? getImageProps({ src: showcaseArt, alt: "", fill: true, sizes: SHOWCASE_SIZES }).props : null;

  return (
    <main className="discovery-page">
      <section className="home-intro">
        <div>
          <h1>Find your next favorite indie game</h1>
          <p className="lede">Name a game you can&rsquo;t stop thinking about, and we&rsquo;ll find the indies that give you that feeling again.</p>
          <p className="examples">Try {EXAMPLES.map(([appid, title], index) => <span key={appid}>
            <Link href={`/games/${appid}`} prefetch={true}>{title}</Link>{index < EXAMPLES.length - 1 ? ", " : ""}
          </span>)}</p>
        </div>
        {showcase && <div className="showcase">
          <Link href={`/games/${showcase.appid}`} prefetch={true} className="showcase-source">
            {showcasePreload && <link rel="preload" as="image" imageSrcSet={showcasePreload.srcSet} imageSizes={showcasePreload.sizes} fetchPriority="high" media="(min-width: 701px)" />}
            {showcaseArt && <Image src={showcaseArt} alt="" fill sizes={SHOWCASE_SIZES} loading="lazy" className="object-cover" />}
            <span>Games like <strong>{showcase.title}</strong></span>
          </Link>
          <div className="showcase-recs">
            {showcaseRecs.map(game => <Link key={game.appid} href={`/games/${game.appid}`} prefetch={true} title={game.title}>
              <span className="showcase-tile"><Cover title={game.title} cover={game.cover} header={game.header_image} sizes="120px" /></span>
            </Link>)}
          </div>
        </div>}
      </section>
      <Shelf slug="rising" games={shelves.rising} aboveFold />
      <Shelf slug="early-access" games={shelves["early-access"]} />
      <Shelf slug="hidden-gems" games={shelves["hidden-gems"]} />
      {shelves.new.length >= 6 && <Shelf slug="new" games={shelves.new} />}
      <Shelf slug="upcoming" games={shelves.upcoming} />
      <section>
        <ShelfHeading title="Browse all" />
        {games.length ? <GameGrid initialGames={games} /> : <EmptyNote>The catalog is being updated. Please check back soon.</EmptyNote>}
      </section>
    </main>
  );
}

function Shelf({ slug, games, aboveFold = false }: { slug: ShelfSlug; games: CardGame[]; aboveFold?: boolean }) {
  if (!games.length) return null;
  return <section>
    <ShelfHeading title={SHELVES[slug].title} note={SHELVES[slug].note} href={`/discover/${slug}`} />
    <CardGrid games={games} eager={aboveFold ? 6 : 0} />
  </section>;
}
