import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameGrid } from "@/components/GameGrid";
import type { GameCardGame } from "@/lib/supabase/types";



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

  return (
    <main className="discovery-page">
      <section className="home-intro">
        <div>
          <h1>Indie games like<br /><em>your favorites.</em></h1>
          <p>Search a game you know. Find independent games with similar gameplay, themes, and feel.</p>
        </div>
        <div className="featured-art" aria-label="Discover indie favorites">
          {games.slice(0,2).map(game => <Link key={game.appid} href={`/games/${game.appid}`} prefetch={true}>
            {game.header_image && <Image src={game.header_image} alt={game.title} width={460} height={215} priority />}
          </Link>)}
        </div>
      </section>
      <section>
        <div className="section-heading"><h2>A good place to start</h2></div>
        {games.length ? <GameGrid initialGames={games} /> : <p className="text-muted-foreground">The catalog is being updated. Please check back soon.</p>}
      </section>
    </main>
  );
}
