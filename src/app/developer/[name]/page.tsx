import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameCardAsync } from "@/components/GameCardAsync";

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

  const title = `Games by ${developerName} — IndieFindr`;
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
  const supabase = await getSupabaseServerClient();

  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title, header_image")
    .contains("developers", [developerName])
    .order("created_at", { ascending: false });

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
      <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Games by {developerName}</h1>
          <p className="text-muted-foreground">
            {games.length} {games.length === 1 ? "game" : "games"} found
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map((game) => (
            <GameCardAsync key={game.appid} appid={game.appid} />
          ))}
        </div>
      </main>
    </>
  );
}
