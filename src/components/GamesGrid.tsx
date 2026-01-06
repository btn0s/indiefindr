"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import GameCard from "@/components/GameCard";
import { Spinner } from "@/components/ui/spinner";
import { loadMoreGames } from "@/app/actions";
import type { GameCardGame } from "@/lib/supabase/types";

const PAGE_SIZE = 24;

interface GamesGridProps {
  initialGames: GameCardGame[];
}

export function GamesGrid({ initialGames }: GamesGridProps) {
  const [games, setGames] = useState(initialGames);
  const [offset, setOffset] = useState(initialGames.length);
  const [hasMore, setHasMore] = useState(initialGames.length === PAGE_SIZE);
  const [isPending, startTransition] = useTransition();
  const loaderRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<GameCardGame[]>(initialGames);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || isPending) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startTransition(async () => {
            const newGames = await loadMoreGames(offset);
            if (!newGames || newGames.length === 0) {
              setHasMore(false);
            } else {
              const seen = new Set(gamesRef.current.map((g) => g.appid));
              const uniqueNew = newGames.filter((g) => !seen.has(g.appid));

              if (uniqueNew.length === 0) {
                setHasMore(false);
                return;
              }

              setGames((prev) => [...prev, ...uniqueNew]);
              setOffset((prev) => prev + newGames.length);
              if (newGames.length < PAGE_SIZE) setHasMore(false);
            }
          });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [offset, hasMore, isPending]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-fr">
        {games.map((game) => (
          <GameCard key={game.appid} {...game} />
        ))}
      </div>
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-8">
          {isPending && <Spinner />}
        </div>
      )}
    </>
  );
}
