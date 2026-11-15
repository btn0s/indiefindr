import type { Metadata } from "next";
import Link from "next/link";
import { GameGrid } from "@/components/GameGrid";
import { getBrowsePage, getHomeShelves, SHELVES, type BoxGame, type ShelfSlug } from "@/lib/catalog";
import { ShelfHeading } from "@/components/ShelfHeading";
import { CardRail } from "@/components/CardRail";
import { EmptyNote } from "@/components/EmptyNote";

// Any game works as a starting point, AAA included; recommendations are always indie.
const EXAMPLES = [[413150, "Stardew Valley"], [367520, "Hollow Knight"], [2379780, "Balatro"]] as const;

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
  const [shelves, games] = await Promise.all([getHomeShelves(), getBrowsePage(0)]);

  return (
    <main className="discovery-page">
      <section className="home-intro">
        <h1>Find your next favorite indie game</h1>
        <p className="lede">Name a game you can&rsquo;t stop thinking about, and we&rsquo;ll find the indies that give you that feeling again.</p>
        <p className="examples">Try {EXAMPLES.map(([appid, title], index) => <span key={appid}>
          <Link href={`/games/${appid}`} prefetch={true}>{title}</Link>{index < EXAMPLES.length - 1 ? ", " : ""}
        </span>)}</p>
      </section>
      <Shelf slug="rising" games={shelves.rising} eager={5} />
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

/** A home shelf as a rail of box art. The first one is on screen as the page opens, so its first row of covers loads
 *  with the page. */
function Shelf({ slug, games, eager = 0 }: { slug: ShelfSlug; games: BoxGame[]; eager?: number }) {
  return <CardRail games={games} title={SHELVES[slug].title} note={SHELVES[slug].note} href={`/discover/${slug}`} box eager={eager} />;
}
