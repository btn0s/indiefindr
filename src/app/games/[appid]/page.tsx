import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { GameVideo } from "@/components/GameVideo";
import { SuggestionsList } from "@/components/SuggestionsList";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { RefreshSuggestionsButton } from "@/components/RefreshSuggestionsButton";
import { ArrowLeftIcon, ArrowUpRight } from "lucide-react";
import { fetchSteamGame } from "@/lib/steam";
import { supabase } from "@/lib/supabase/server";

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

  // Try database first
  const { data: dbGame } = await supabase
    .from("games_new")
    .select("appid, title, header_image, short_description, long_description, screenshots, videos")
    .eq("appid", appId)
    .maybeSingle();

  let gameData: {
    appid: number;
    title: string;
    header_image: string | null;
    short_description: string | null;
    long_description: string | null;
    screenshots: string[];
    videos: string[];
  };

  if (dbGame) {
    // Use cached data from database
    gameData = {
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
      const steamData = await fetchSteamGame(appid);
      gameData = steamData;
    } catch (error) {
      console.error("Failed to fetch game data:", error);
      notFound();
    }
  }

  const description =
    gameData.long_description || gameData.short_description || null;

  return (
    <div className="min-h-screen">
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
