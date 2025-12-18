"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelatedGameCard } from "@/components/RelatedGameCard";
import type { Game, RelatedGame } from "@/lib/supabase/types";
import { ArrowLeftIcon } from "lucide-react";

export default function GameDetailPage() {
  const params = useParams();
  const appid = params.appid as string;
  const [game, setGame] = useState<Game | null>(null);
  const [relatedGames, setRelatedGames] = useState<{
    aesthetic: RelatedGame[];
    gameplay: RelatedGame[];
    narrative: RelatedGame[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const loadGameData = useCallback(async () => {
    try {
      setLoading(true);
      const [gameResponse, relatedResponse] = await Promise.all([
        fetch(`/api/games/${appid}`),
        fetch(`/api/games/${appid}/related?facet=all&limit=10&threshold=0.55`),
      ]);

      if (!gameResponse.ok) {
        throw new Error("Failed to load game");
      }

      const gameData = await gameResponse.json();
      setGame(gameData);

      if (relatedResponse.ok) {
        const relatedData = await relatedResponse.json();
        setRelatedGames(relatedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setLoading(false);
    }
  }, [appid]);

  useEffect(() => {
    if (appid) {
      loadGameData();
    }
  }, [appid, loadGameData]);

  const handleRerun = async () => {
    if (!game) return;

    setRerunning(true);
    setRerunError(null);

    try {
      // Construct Steam URL from appid
      const steamUrl = `https://store.steampowered.com/app/${appid}/`;

      const response = await fetch("/api/games/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rerun ingestion");
      }

      // Reload game data after successful rerun
      await loadGameData();
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex flex-col gap-4">
            <p className="text-destructive">{error || "Game not found"}</p>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const tags = game.tags ? Object.keys(game.tags) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeftIcon className="size-4" /> Back to Home
            </Button>
          </Link>
          <Button onClick={handleRerun} disabled={rerunning} variant="outline">
            {rerunning ? "Rerunning..." : "Rerun Ingestion"}
          </Button>
        </div>
        {rerunError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-destructive text-sm">{rerunError}</p>
          </div>
        )}

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
