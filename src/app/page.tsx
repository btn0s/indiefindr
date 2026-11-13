import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";
import { getGame, getHomeShelves, getRecommendations } from "@/lib/catalog";
import { GameCard } from "@/components/GameCard";

// Well-known indies whose pages show off the recommendations; one is featured per revalidation.
const SHOWCASE = [413150, 367520, 105600, 1145360, 504230, 646570];
// Any game works as a starting point, AAA included; recommendations are always indie.
const EXAMPLES = [[413150, "Stardew Valley"], [1938090, "Call of Duty"], [1245620, "Elden Ring"], [2379780, "Balatro"], [367520, "Hollow Knight"]] as const;
const pickShowcase = () => SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)];



const PAGE_SIZE = 24;

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/`;
  const title = "Find Your Next Favorite Indie Game — IndieFindr";
  const description =
    "Discover indie games on Steam. Search any game, get indie game recommendations, and find your next favorite.";
  const ogImageUrl = `${siteUrl}/og/home.png`;

  return {
    title,
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
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("games").select("appid, title, header_image").eq("is_indie", true).order("review_count", { ascending: false }).order("appid").range(0, PAGE_SIZE - 1);

  const games: GameCardGame[] = error
    ? []
    : (data || []).map((g) => ({
        appid: g.appid,
        title: g.title,
        header_image: g.header_image,
      }));

  if (error) {
    console.error("Error loading games:", error);
  }

  const showcaseId = pickShowcase();
  const [showcase, showcaseRecs, shelves] = await Promise.all([getGame(showcaseId), getRecommendations(showcaseId), getHomeShelves()]);

  return (
    <main className="discovery-page">
      <section className="home-intro">
        <div>
          <h1>Indie games like<br /><em>your favorites.</em></h1>
          <p>Start with any game you know. We&rsquo;ll find independent games with similar gameplay, themes, and feel.</p>
          <p className="examples">Try {EXAMPLES.map(([appid, title], index) => <span key={appid}>
            <Link href={`/games/${appid}`} prefetch={true}>{title}</Link>{index < EXAMPLES.length - 1 ? ", " : ""}
          </span>)}</p>
        </div>
        {showcase && <div className="showcase">
          <Link href={`/games/${showcase.appid}`} prefetch={true} className="showcase-source">
            {showcase.header_image && <Image src={showcase.header_image} alt="" width={460} height={215} priority />}
            <span>Games like <strong>{showcase.title}</strong></span>
          </Link>
          <div className="showcase-recs">
            {showcaseRecs.slice(0, 3).map(({ game }) => <Link key={game.appid} href={`/games/${game.appid}`} prefetch={true} title={game.title}>
              {game.header_image && <Image src={game.header_image} alt={game.title} width={230} height={108} />}
            </Link>)}
          </div>
        </div>}
      </section>
      <Shelf title="Rising" note="Breakout indies from the past year" games={shelves.rising} />
      <Shelf title="Hidden gems" note="Loved by players, still under the radar · new picks daily" games={shelves.gems} />
      {shelves.fresh.length >= 4 && <Shelf title="New on Steam" note="Released in the last two months" games={shelves.fresh.slice(0, 4)} />}
      <section>
        <div className="section-heading"><h2>Browse all</h2></div>
        {games.length ? <GameGrid initialGames={games} /> : <p className="text-muted-foreground">The catalog is being updated. Please check back soon.</p>}
      </section>
    </main>
  );
}

function Shelf({ title, note, games }: { title: string; note: string; games: GameCardGame[] }) {
  if (!games.length) return null;
  return <section className="shelf">
    <div className="section-heading"><h2>{title}</h2><span>{note}</span></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6">
      {games.map(game => <GameCard key={game.appid} {...game} />)}
    </div>
  </section>;
}
