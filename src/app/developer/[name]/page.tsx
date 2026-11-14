import { CARD_FIELDS } from "@/lib/catalog";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CardGrid } from "@/components/CardGrid";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const developerName = decodeURIComponent(name);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/developer/${name}`;

  const title = `Games by ${developerName}`;
  const description = `Browse all indie games developed by ${developerName} on Steam.`;

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
      card: "summary",
      title,
      description,
    },
  };
}

async function getGamesByDeveloper(developerName: string) {
  "use cache";
  cacheLife("hours");
  const supabase = getSupabaseServerClient();

  const { data: games, error } = await supabase
    .from("games")
    .select(CARD_FIELDS)
    .contains("developers", [developerName])
    .eq("is_indie", true)
    .order("release_date", { ascending: false });

  if (error || !games) {
    return [];
  }

  return games;
}

export default async function DeveloperQueryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const developerName = decodeURIComponent(name);

  const games = await getGamesByDeveloper(developerName);

  if (games.length === 0) {
    notFound();
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

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
        name: "Games by " + developerName,
        item: `${siteUrl}/developer/${name}`,
      },
    ],
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Games by ${developerName}`,
    numberOfItems: games.length,
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoGame",
        name: game.title,
        url: `${siteUrl}/games/${game.appid}`,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema),
        }}
      />
      <main className="discovery-page">
        <header className="page-head">
          <h1 className="page-title">Games by {developerName}</h1>
          <p className="page-note">
            {games.length} {games.length === 1 ? "game" : "games"} in the catalog
          </p>
        </header>

        <CardGrid games={games} eager={8} />
      </main>
    </>
  );
}
