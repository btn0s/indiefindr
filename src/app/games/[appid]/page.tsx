import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelatedGameCard } from "@/components/RelatedGameCard";
import { RerunButton } from "@/components/RerunButton";
import { supabase } from "@/lib/supabase/server";
import type { Game, RelatedGame } from "@/lib/supabase/types";
import { ArrowLeftIcon } from "lucide-react";

async function getGame(appid: string): Promise<Game | null> {
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return null;
  }

  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", appId)
    .single();

  if (error || !game) {
    return null;
  }

  return game;
}

async function getRelatedGames(appid: string): Promise<{
  aesthetic: RelatedGame[];
  gameplay: RelatedGame[];
  narrative: RelatedGame[];
} | null> {
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return null;
  }

  const facets = ["aesthetic", "gameplay", "narrative"];
  const results: Record<string, RelatedGame[]> = {};

  for (const facetName of facets) {
    const { data, error } = await supabase.rpc("get_related_games", {
      p_appid: appId,
      p_facet: facetName,
      p_limit: 10,
      p_threshold: 0.55,
    });

    if (error) {
      console.error(`Error fetching ${facetName} similar games:`, error);
      results[facetName] = [];
    } else {
      results[facetName] = (data || []) as RelatedGame[];
    }
  }

  return {
    aesthetic: results.aesthetic || [],
    gameplay: results.gameplay || [],
    narrative: results.narrative || [],
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;
  const [game, relatedGames] = await Promise.all([
    getGame(appid),
    getRelatedGames(appid),
  ]);

  if (!game) {
    notFound();
  }

  const tags = game.tags ? Object.keys(game.tags) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between relative">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeftIcon className="size-4" /> Back to Home
            </Button>
          </Link>
          <div className="relative">
            <RerunButton appid={appid} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold">Games like {game.name}</h1>

        {/* Game Header */}
        <div className="flex gap-4">
          {game.header_image && (
            <Image
              src={game.header_image}
              alt={game.name}
              width={460}
              height={215}
              className="aspect-video w-1/3 object-cover rounded-lg"
              unoptimized
            />
          )}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div>{game.name}</div>
              <a
                href={`https://store.steampowered.com/app/${appid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-xs"
              >
                View on Steam
              </a>
            </div>
            {game.description && (
              <p className="text-muted-foreground line-clamp-4 text-xs">
                {game.description.replace(/<[^>]*>/g, "").substring(0, 300)}
                {game.description.length > 300 ? "..." : ""}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 10).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related Games by Facet */}
        {relatedGames && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Similar by Aesthetics</h2>
              {relatedGames.aesthetic.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No similar games found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedGames.aesthetic.map((related) => (
                    <RelatedGameCard key={related.appid} game={related} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Similar by Gameplay</h2>
              {relatedGames.gameplay.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No similar games found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedGames.gameplay.map((related) => (
                    <RelatedGameCard key={related.appid} game={related} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">
                Similar by Narrative/Mood
              </h2>
              {relatedGames.narrative.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No similar games found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedGames.narrative.map((related) => (
                    <RelatedGameCard key={related.appid} game={related} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
