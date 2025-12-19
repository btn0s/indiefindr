import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsList } from "@/components/SuggestionsList";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { RefreshSuggestionsButton } from "@/components/RefreshSuggestionsButton";
import { ArrowLeftIcon, ArrowUpRight } from "lucide-react";
import { fetchSteamGame } from "@/lib/steam";
import { supabase } from "@/lib/supabase/server";

async function getGameData(appId: number) {
  // Try database first
  const { data: dbGame } = await supabase
    .from("games_new")
    .select("appid, title, header_image, short_description, long_description, screenshots, videos")
    .eq("appid", appId)
    .maybeSingle();

  if (dbGame) {
    // Use cached data from database
    return {
      appid: dbGame.appid,
      title: dbGame.title || "",
      header_image: dbGame.header_image,
      short_description: dbGame.short_description,
      long_description: dbGame.long_description,
      screenshots: dbGame.screenshots || [],
      videos: dbGame.videos || [],
    };
  } else {
    // Fall back to Steam API
    try {
      const steamData = await fetchSteamGame(appId.toString());
      return steamData;
    } catch (error) {
      console.error("Failed to fetch game data:", error);
      return null;
    }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ appid: string }>;
}): Promise<Metadata> {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return {
      title: "Game Not Found | IndieFindr",
    };
  }

  const gameData = await getGameData(appId);

  if (!gameData || !gameData.title) {
    return {
      title: "Game Not Found | IndieFindr",
    };
  }

  const description =
    gameData.long_description || gameData.short_description || null;
  const cleanDescription = description
    ? description.replace(/<[^>]*>/g, "").substring(0, 160)
    : `Discover games similar to ${gameData.title}. Find your next favorite indie game based on gameplay, style, and features.`;

  const title = `Games like ${gameData.title} | IndieFindr`;
  
  // Get base URL dynamically from headers
  const headersList = await headers();
  const host = headersList.get("host") || "indiefindr.gg";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;
  const url = `${baseUrl}/games/${appid}`;
  
  // Handle image URL - use absolute URL if provided, otherwise use fallback
  const image = gameData.header_image 
    ? (gameData.header_image.startsWith("http") 
        ? gameData.header_image 
        : `${baseUrl}${gameData.header_image}`)
    : `${baseUrl}/vercel.svg`;

  return {
    title,
    description: cleanDescription,
    openGraph: {
      title,
      description: cleanDescription,
      url,
      siteName: "IndieFindr",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: gameData.title,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: [image],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    notFound();
  }

  const gameData = await getGameData(appId);

  if (!gameData || !gameData.title) {
    notFound();
  }

  const description =
    gameData.long_description || gameData.short_description || null;

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: gameData.title,
    description: description
      ? description.replace(/<[^>]*>/g, "").substring(0, 500)
      : undefined,
    image: gameData.header_image || undefined,
    url: `https://store.steampowered.com/app/${appid}/`,
    gamePlatform: "Steam",
    applicationCategory: "Game",
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between relative">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeftIcon className="size-4" /> Back to Home
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-semibold">Games like {gameData.title}</h1>

        {/* Trailer Video - Full Width */}
        {gameData.videos && gameData.videos.length > 0 && (
          <div className="w-full aspect-video">
            <GameVideo
              videos={gameData.videos}
              headerImage={gameData.header_image}
              alt={gameData.title}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Game Header */}
        <div className="flex gap-4">
          {gameData.header_image && (
            <div className="w-1/3 aspect-video">
              <Image
                src={gameData.header_image}
                alt={gameData.title}
                width={460}
                height={215}
                className="w-full h-full object-cover rounded-lg"
                unoptimized
              />
            </div>
          )}
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-lg font-semibold mb-0">{gameData.title}</div>

            {description && (
              <p className="text-muted-foreground line-clamp-4 text-sm mb-2">
                {description.replace(/<[^>]*>/g, "").substring(0, 300)}
                {description.length > 300 ? "..." : ""}
              </p>
            )}

            <Button className="w-fit">
              <a
                href={`https://store.steampowered.com/app/${appid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                View on Steam
                <ArrowUpRight className="size-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Suggestions Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Similar Games</h2>
            <RefreshSuggestionsButton appid={appid} />
          </div>
          <Suspense fallback={<SuggestionsSkeleton />}>
            <SuggestionsList appid={appId} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
