import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SteamLink } from "@/components/SteamLink";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getGame } from "@/lib/catalog";

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

  const data = await getGame(appId);

  if (!data) {
    return { title: "Game Not Found" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/games/${appId}`;

  const title = `Games like ${data.title}`;
  const description = data.short_description
    ? `Discover games similar to ${data.title}. ${data.short_description} Get indie game recommendations with explanations.`
    : `Find games similar to ${data.title} on Steam. Get indie game recommendations with explanations.`;

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
        name: "Games",
        item: `${siteUrl}/games`,
      },
      {
        "@type": "ListItem",
        position: 3,
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
      <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
        <article itemScope itemType="https://schema.org/VideoGame">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">{game.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {game.developers.length > 0 && (
                  <span>By {game.developers.join(", ")}</span>
                )}
                {game.release_date && <span>{game.release_date}</span>}
              </div>
            </div>
            {game.short_description && (
              <p className="text-muted-foreground">{game.short_description}</p>
            )}

            <SteamLink appid={appId} />
          </div>
        </article>

        <SameDeveloperSection appId={appId} developers={game.developers} />

        <SuggestionsSection appId={appId} gameTitle={game.title} />
      </main>
    </>
  );
}
