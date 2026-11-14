import { WebMCP } from "@/components/WebMCP";
import { getReviewHistory } from "@/lib/review-history";
import { isRescued } from "@/lib/review-quality";
import { notFound } from "next/navigation";
import { GameTrailer, type Trailer } from "@/components/GameTrailer";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { ShopLinks } from "@/components/ShopLinks";
import { SteamLink } from "@/components/SteamLink";
import { GameMetadata } from "@/components/GameMetadata";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getGamePageSlate, getGame, getRecommendations } from "@/lib/catalog";

import { SuggestionsSection } from "./suggestions-section";
import { SameDeveloperSection } from "./same-developer-section";

// Popular pages are built ahead of time; other catalog pages are cached on demand.
export const revalidate = 3600;
export const dynamic = "force-static";
export async function generateStaticParams() {
  const { data, error } = await getSupabaseServerClient().from("games")
    .select("appid").order("review_count", { ascending: false }).limit(100);
  if (error) throw new Error("Catalog unavailable");
  return (data ?? []).map(game => ({ appid: String(game.appid) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ appid: string }>;
}): Promise<Metadata> {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return { title: "Game Not Found" };
  }

  const [data, recs] = await Promise.all([getGame(appId), getRecommendations(appId)]);

  if (!data) {
    return { title: "Game Not Found" };
  }
  const names = recs.slice(0, 3).map(({ game }) => game.title);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/games/${appId}`;

  const title = recs.length ? `Games Like ${data.title}: ${recs.length} Indie Games to Play Next` : `Games Like ${data.title}`;
  const description = names.length
    ? `Love ${data.title}? Try ${names.join(", ")}${recs.length > names.length ? ` and ${recs.length - names.length} more` : ""}: indie games with similar gameplay, themes, and feel.`
    : `Indie games like ${data.title}, with similar gameplay, themes, and feel.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    notFound();
  }

  // Only fetch critical game data - suggestions load separately via Suspense
  const game = await getGame(appId);

  if (!game) {
    notFound();
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

  // Structured data schemas
  const videoGameSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.short_description || undefined,
    image: game.header_image || undefined,
    url: `${siteUrl}/games/${appId}`,
    gamePlatform: "Steam",
    sameAs: `https://store.steampowered.com/app/${appId}/`,
    ...(game.developers.length > 0 && {
      author: {
        "@type": "Organization",
        name: game.developers[0],
      },
    }),
    ...(game.release_date && {
      datePublished: game.release_date,
    }),
  };

  const [{ recs, developerGames }, reviewHistory] = await Promise.all([getGamePageSlate(appId, game.developers), isRescued(game) ? getReviewHistory(appId) : Promise.resolve(null)]);
  const recommendationsSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Indie games like ${game.title}`,
    itemListElement: recs.map(({ game: rec }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/games/${rec.appid}`,
      name: rec.title,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: game.title,
        item: `${siteUrl}/games/${appId}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(videoGameSchema).replace(/</g, "\\u003c"),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
        }}
      />
      {recs.length > 0 && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(recommendationsSchema).replace(/</g, "\\u003c"),
        }}
      />}
      <WebMCP />
      <main className="discovery-page">
        <article className="source-game" itemScope itemType="https://schema.org/VideoGame">
          <header className="source-header">
            <div className="page-head">
            <h1 className="page-title"><span className="title-lead">Games like</span>{" "}<span itemProp="name">{game.title}</span></h1>
            <GameMetadata game={game} history={reviewHistory} />
            </div>
          </header>
          <GameTrailer title={game.title} still={game.screenshots?.[0] ?? game.header_image}
            trailer={((Array.isArray(game.trailers) ? game.trailers : []) as Trailer[])[0] ?? null} />
          {game.short_description && <p className="source-description" itemProp="description">{game.short_description}</p>}
          <div className="source-game-actions"><SteamLink appid={appId} price={game.is_free ? "Free" : game.price_cents != null ? `$${(game.price_cents / 100).toFixed(2)}` : null} /></div>
          <ShopLinks appid={appId} />
        </article>
        <SameDeveloperSection developers={game.developers} games={developerGames} />
        <SuggestionsSection appId={appId} gameTitle={game.title} recs={recs} />
        <AdSlot />
      </main>
    </>
  );
}
