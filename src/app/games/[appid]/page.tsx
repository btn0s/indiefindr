import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { GameVideo } from "@/components/GameVideo";
import { ArrowLeftIcon, ArrowUpRight } from "lucide-react";
import { fetchSteamGame } from "@/lib/steam";
import { supabase } from "@/lib/supabase/server";
import type { Suggestion } from "@/lib/supabase/types";

async function getSuggestion(appid: number): Promise<Suggestion | null> {
  const { data, error } = await supabase
    .from("suggestions")
    .select("*")
    .eq("steam_appid", appid)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching suggestion:", error);
    return null;
  }

  return data as Suggestion;
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

  let gameData: Awaited<ReturnType<typeof fetchSteamGame>>;
  try {
    gameData = await fetchSteamGame(appid);
  } catch (error) {
    console.error("Failed to fetch game data:", error);
    notFound();
  }

  const description =
    gameData.long_description || gameData.short_description || null;

  // Fetch suggestions for this game
  const suggestion = await getSuggestion(appId);

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
        {suggestion && (
          <div className="flex flex-col gap-4 mt-8">
            <h2 className="text-xl font-semibold">Similar Games</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-muted-foreground">
                {suggestion.result_text}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
