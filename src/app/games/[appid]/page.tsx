import { WebMCP } from "@/components/WebMCP";
import { notFound } from "next/navigation";
import { heroImage } from "@/lib/hero";
import { GameTrailer, type Trailer } from "@/components/GameTrailer";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { ShopLinks } from "@/components/ShopLinks";
import { SteamLink } from "@/components/SteamLink";
import { GameFacts } from "@/components/GameFacts";
import { ScreenshotStrip } from "@/components/ScreenshotStrip";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getGamePageSlate, getGame, getRecommendations } from "@/lib/catalog";

import { SuggestionsSection } from "./suggestions-section";
import { SameDeveloperSection } from "./same-developer-section";

// The 100 most-reviewed games are prerendered at build; the rest render on first visit and are cached after.
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
    return { title: "Game not found" };
  }

  const [data, recs] = await Promise.all([getGame(appId), getRecommendations(appId)]);

  if (!data) {
    return { title: "Game not found" };
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
    title: { absolute: title },
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
  const trailer = ((Array.isArray(game.trailers) ? game.trailers : []) as Trailer[])[0] ?? null;

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

  const { recs, developerGames } = await getGamePageSlate(appId, game.developers);
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

  const price = game.is_free ? "Free" : game.price_cents != null ? `$${(game.price_cents / 100).toFixed(2)}` : null;

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
        {/* Cover hero: the trailer (its poster or still until it plays) as a framed plate on the page, whole and unfaded.
            On desktop the title, facts, blurb and Steam button sit beside it; on phones, beneath it. */}
        <article className="source-game" itemScope itemType="https://schema.org/VideoGame">
          <GameTrailer title={game.title} trailer={trailer} base={game.header_image}
            image={heroImage({ hero_poster: trailer?.poster, hero_still: game.screenshots?.[0], header_image: game.header_image })} />
          <div className="source-info">
            <header className="source-header">
              <h1 className="page-title"><span className="title-lead">Games like</span> <span itemProp="name">{game.title}</span></h1>
              <GameFacts game={game} />
              {game.short_description && <p className="source-description" itemProp="description">{game.short_description}</p>}
            </header>
            <div className="source-game-actions"><SteamLink appid={appId} price={price} /></div>
          </div>
          <ScreenshotStrip title={game.title} screenshots={game.screenshots ?? []} />
          <ShopLinks appid={appId} />
        </article>
        <SameDeveloperSection developers={game.developers} games={developerGames} />
        <SuggestionsSection appId={appId} recs={recs} />
        <AdSlot />
      </main>
    </>
  );
}
