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
    <main className="flex flex-col gap-8 pt-8">
      <div className="w-full">
        <div className="container mx-auto max-w-4xl w-full">
          <h1 className="text-balance font-semibold tracking-tight text-3xl sm:text-4xl">
            Find your next favorite indie game
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
          <h2 className="font-semibold text-xl">All Games</h2>
        </div>
        <div className="container mx-auto max-w-4xl w-full">
          {games.length === 0 ? (
            <p className="text-muted-foreground">
              The catalog is being updated. Please check back soon.
            </p>
          ) : (
            <GameGrid initialGames={games} />
          )}
        </div>
      </div>
    </main>
  );
}
