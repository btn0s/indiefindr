import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";
import { getBrowsePage, getGame, getHomeShelves, getRecommendations, SHELVES, type ShelfSlug } from "@/lib/catalog";
import { heroImage } from "@/lib/hero";
import { ShelfHeading } from "@/components/ShelfHeading";
import { CardRail } from "@/components/CardRail";
import { EmptyNote } from "@/components/EmptyNote";
import { FeatureCards, type Feature } from "@/components/FeatureCards";

// Well-known games whose pages show off the recommendations. Any game works as a starting point, AAA included;
// recommendations are always indie.
const FEATURED = [413150, 367520, 105600, 1145360, 504230, 646570, 2379780];

/** Three featured games, each with its first recommendations. A new draw each time the cache refreshes, about once a
 *  minute. */
async function getFeatures(): Promise<Feature[]> {
  "use cache";
  cacheLife("minutes");
  const pool = [...FEATURED];
  const picks = Array.from({ length: 3 }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  const features = await Promise.all(picks.map(async appid => {
    const [game, recs] = await Promise.all([getGame(appid), getRecommendations(appid)]);
    if (!game) return null;
    const trailer = (Array.isArray(game.trailers) ? game.trailers : [])[0] as { poster?: string | null } | undefined;
    return {
      appid, title: game.title,
      cover: heroImage({ hero_poster: trailer?.poster, hero_still: game.screenshots?.[0], header_image: game.header_image }),
      recs: recs.slice(0, 3).map(({ game: rec }) => rec),
    };
  }));
  return features.filter(feature => feature !== null);
}

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
  const [features, shelves, games] = await Promise.all([getFeatures(), getHomeShelves(), getBrowsePage(0)]);

  return (
    <main className="discovery-page home">
      <header className="home-head">
        <h1 className="page-title">Find your next favorite indie game</h1>
        <p className="page-note">Name a game you can&rsquo;t stop thinking about, and we&rsquo;ll find the indies that give you that feeling again.</p>
      </header>
      <FeatureCards features={features} />
      <Shelf slug="rising" games={shelves.rising} />
      <Shelf slug="early-access" games={shelves["early-access"]} />
      <Shelf slug="hidden-gems" games={shelves["hidden-gems"]} />
      {shelves.new.length >= 4 && <Shelf slug="new" games={shelves.new} />}
      <Shelf slug="upcoming" games={shelves.upcoming} />
      <section>
        <ShelfHeading title="Browse all" />
        {games.length ? <GameGrid initialGames={games} /> : <EmptyNote>The catalog is being updated. Please check back soon.</EmptyNote>}
      </section>
    </main>
  );
}

function Shelf({ slug, games }: { slug: ShelfSlug; games: GameCardGame[] }) {
  return <CardRail games={games} title={SHELVES[slug].title} note={SHELVES[slug].note} href={`/discover/${slug}`} />;
}
