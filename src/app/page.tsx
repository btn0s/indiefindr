import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";
import { getBrowsePage, getGame, getHomeShelves, getRecommendations, SHELVES, type ShelfSlug } from "@/lib/catalog";
import { ShelfHeading } from "@/components/ShelfHeading";
import { GameCard } from "@/components/GameCard";
import { EmptyNote } from "@/components/EmptyNote";

// Well-known indies whose pages show off the recommendations; one is featured per revalidation.
const SHOWCASE = [413150, 367520, 105600, 1145360, 504230, 646570];
// Any game works as a starting point, AAA included; recommendations are always indie.
const EXAMPLES = [[413150, "Stardew Valley"], [367520, "Hollow Knight"], [2379780, "Balatro"]] as const;
const pickShowcase = () => SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)];

export const revalidate = 60;

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

  const showcaseId = pickShowcase();
  const [showcase, showcaseRecs, shelves] = await Promise.all([getGame(showcaseId), getRecommendations(showcaseId), getHomeShelves()]);

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
            {showcase.header_image && <Image src={showcase.header_image} alt="" width={460} height={215} preload loading="eager" fetchPriority="high" />}
            <span>Games like <strong>{showcase.title}</strong></span>
          </Link>
          <div className="showcase-recs">
            {showcaseRecs.slice(0, 3).map(({ game }) => <Link key={game.appid} href={`/games/${game.appid}`} prefetch={true} title={game.title}>
              <span className="showcase-tile">{game.header_image && <Image src={game.header_image} alt={game.title} width={230} height={108} preload />}</span>
            </Link>)}
          </div>
        </div>}
      </section>
      <Shelf slug="rising" games={shelves.rising} aboveFold />
      <Shelf slug="hidden-gems" games={shelves.gems} />
      {shelves.fresh.length >= 4 && <Shelf slug="new" games={shelves.fresh} />}
      <section>
        <ShelfHeading title="Browse all" />
        {games.length ? <GameGrid initialGames={games} /> : <EmptyNote>The catalog is being updated. Please check back soon.</EmptyNote>}
      </section>
    </main>
  );
}

function Shelf({ slug, games, aboveFold = false }: { slug: ShelfSlug; games: GameCardGame[]; aboveFold?: boolean }) {
  if (!games.length) return null;
  return <section>
    <ShelfHeading title={SHELVES[slug].title} note={SHELVES[slug].note} href={`/discover/${slug}`} />
    <div className="game-grid">
      {games.map((game, index) => <GameCard key={game.appid} {...game} preload={aboveFold && index < 4} />)}
    </div>
  </section>;
}
