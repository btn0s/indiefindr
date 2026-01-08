import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getOrFetchGame } from "@/lib/actions/games";
import { generateSuggestions } from "@/lib/actions/suggestions";
import { GameVideo } from "@/components/GameVideo";
import { GameCardAsync } from "@/components/GameCardAsync";
import { SuggestionsLoader } from "./suggestions-loader";

type Suggestion = {
  suggested_appid: number;
  reason: string;
};

async function getSuggestions(appId: number): Promise<Suggestion[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appId);

  return data ?? [];
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

  const game = await getOrFetchGame(appId);

  if (!game) {
    return { title: "Game Not Found" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/games/${appId}`;
  const suggestions = await getSuggestions(appId);
  const suggestionCount = suggestions.length;

  const title = `Games like ${game.title}`;
  const description = game.short_description
    ? `Discover ${suggestionCount > 0 ? `${suggestionCount} ` : ""}games similar to ${game.title}. ${game.short_description} Get AI-powered recommendations with explanations.`
    : `Find games similar to ${game.title} on Steam. Get AI-powered recommendations with explanations.`;

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

  const game = await getOrFetchGame(appId);

  if (!game) {
    notFound();
  }

  const suggestions = await getSuggestions(appId);
  const hasSuggestions = suggestions.length > 0;

  async function generate() {
    "use server";
    await generateSuggestions(appId);
    revalidatePath(`/games/${appId}`);
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

  const videoObjectSchema =
    game.videos.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: `${game.title} - Trailer`,
          description: game.short_description || `Trailer for ${game.title}`,
          thumbnailUrl: game.header_image || undefined,
          uploadDate: game.release_date || undefined,
          contentUrl: game.videos[0],
        }
      : null;

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
          __html: JSON.stringify(videoGameSchema),
        }}
      />
      {videoObjectSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoObjectSchema),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
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
            {game.videos.length > 0 && (
              <div className="w-full aspect-video">
                <GameVideo
                  videos={game.videos}
                  headerImage={game.header_image}
                  alt={game.title}
                  className="w-full h-full"
                  autoPlay
                />
              </div>
            )}
            {game.short_description && (
              <p className="text-muted-foreground">{game.short_description}</p>
            )}

            <a
              href={`https://store.steampowered.com/app/${appId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-gradient-to-b from-primary/90 to-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),inset_0_-1px_0_0_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.2)] border border-primary/80 hover:from-primary hover:to-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-px transition-all"
            >
              View on Steam
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </article>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Games like {game.title}</h2>
          {hasSuggestions ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestions.map((s) => (
              <GameCardAsync
                key={s.suggested_appid}
                appid={s.suggested_appid}
                explanation={s.reason}
              />
            ))}
          </div>
        ) : (
          <form action={generate}>
            <SuggestionsLoader autoSubmit />
          </form>
        )}
      </div>
    </main>
    </>
  );
}
