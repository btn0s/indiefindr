"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "@/components/GameCard";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GameNew, Suggestion } from "@/lib/supabase/types";

type SuggestionsResponse = {
  appid: number;
  title: string | null;
  suggestions: Suggestion[];
  updatedAt: string | null;
};

const POLL_MS = 2000;
const MAX_AUTO_INGEST = 6;
const SLOW_NOTICE_MS = 3500;
const MAX_POLL_INTERVAL = 10000; // Max backoff: 10s
const INITIAL_POLL_INTERVAL = 2000; // Start at 2s
const PREFETCH_SUGGESTIONS_COUNT = 3; // Prefetch top 3 suggestions

export function SuggestionsListClient({ appid }: { appid: number }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [gamesById, setGamesById] = useState<Record<number, GameNew>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  const requestedSuggestRef = useRef(false);
  const requestedIngestRef = useRef<Set<number>>(new Set());
  const lastUpdatedAtRef = useRef<string | null>(null);
  const suggestionsRef = useRef<Suggestion[] | null>(null);
  const gamesByIdRef = useRef<Record<number, GameNew>>({});
  const generatingRef = useRef(false);

  const missingAppIds = useMemo(() => {
    if (!suggestions?.length) return [];
    return suggestions.map((s) => s.appId).filter((id) => !gamesById[id]);
  }, [suggestions, gamesById]);

  const displayGames = useMemo(() => {
    if (!suggestions?.length) return [];

    // Map suggestions to games with explanations (maintain order from suggestions)
    return suggestions
      .map((s) => {
        const game = gamesById[s.appId];
        if (!game) return null;
        const rawType = (game.raw as { type?: string })?.type;
        if (rawType && rawType !== "game") return null;
        return { ...game, explanation: s.explanation };
      })
      .filter((g): g is GameNew & { explanation: string } => Boolean(g));
  }, [suggestions, gamesById]);

  const fetchSuggestions =
    useCallback(async (): Promise<SuggestionsResponse> => {
      const res = await fetch(`/api/games/${appid}/suggestions`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as SuggestionsResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to load suggestions (${res.status})`
        );
      }
      return data;
    }, [appid]);

  const fetchGames = useCallback(
    async (appIds: number[]): Promise<GameNew[]> => {
      if (!appIds.length) return [];
      const res = await fetch("/api/games/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appids: appIds }),
      });
      const data = (await res.json()) as { games?: GameNew[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Failed to load games (${res.status})`);
      }
      return data.games || [];
    },
    []
  );

  const triggerSuggestionGeneration = useCallback(async (): Promise<void> => {
    if (requestedSuggestRef.current) return;
    requestedSuggestRef.current = true;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${appid}/suggestions/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate suggestions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      // Allow retry if generation fails
      requestedSuggestRef.current = false;
    } finally {
      setGenerating(false);
    }
  }, [appid]);

  const ingestGame = useCallback(async (appId: number): Promise<void> => {
    await fetch("/api/games/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steamUrl: `https://store.steampowered.com/app/${appId}/`,
        skipSuggestions: true,
      }),
    });
  }, []);

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    gamesByIdRef.current = gamesById;
  }, [gamesById]);

  useEffect(() => {
    generatingRef.current = generating;
  }, [generating]);

  useEffect(() => {
    const isLoading =
      suggestions === null ||
      (suggestions.length === 0 && generating) ||
      missingAppIds.length > 0;

    if (!isLoading) {
      setShowSlowNotice(false);
      return;
    }

    setShowSlowNotice(false);
    const t = setTimeout(() => setShowSlowNotice(true), SLOW_NOTICE_MS);
    return () => clearTimeout(t);
  }, [suggestions, generating, missingAppIds.length]);

  useEffect(() => {
    const shouldPoll =
      suggestions === null ||
      suggestions.length === 0 ||
      missingAppIds.length > 0;

    if (!shouldPoll) return;

    let cancelled = false;
    let pollInterval = INITIAL_POLL_INTERVAL;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isVisible = !document.hidden;

    // Pause polling when tab is hidden
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (!isVisible && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      } else if (isVisible && !intervalId && !cancelled) {
        void tick();
        intervalId = setInterval(tick, pollInterval);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    async function tick() {
      if (!isVisible || cancelled) return;

      try {
        const s = await fetchSuggestions();
        if (cancelled) return;

        const updatedAtChanged =
          lastUpdatedAtRef.current === null ||
          lastUpdatedAtRef.current !== s.updatedAt;
        lastUpdatedAtRef.current = s.updatedAt;

        if (suggestionsRef.current === null || updatedAtChanged) {
          setSuggestions(s.suggestions || []);
        }

        const ids = (s.suggestions || []).map((x) => x.appId);
        if (!ids.length) {
          // If the game exists but has no suggestions, start generation once.
          if (!generatingRef.current) void triggerSuggestionGeneration();
          return;
        }

        // Backoff: if we have suggestions and no missing games, slow down polling
        const hasAllGames = ids.every((id) => gamesByIdRef.current[id]);
        const currentSuggestions = suggestionsRef.current;
        if (hasAllGames && currentSuggestions && currentSuggestions.length > 0) {
          // Exponential backoff: double interval up to max
          pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_INTERVAL);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = setInterval(tick, pollInterval);
          }
        } else {
          // Reset to initial interval when actively fetching
          pollInterval = INITIAL_POLL_INTERVAL;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = setInterval(tick, pollInterval);
          }
        }

        // Only fetch details for games we don't already have.
        const toFetch = ids.filter((id) => !gamesByIdRef.current[id]);
        if (toFetch.length > 0) {
          // Defer heavy work: use requestIdleCallback if available, otherwise setTimeout
          const fetchGamesDeferred = () => {
            void fetchGames(toFetch).then((games) => {
              if (cancelled) return;
              setGamesById((prev) => {
                const next = { ...prev };
                for (const g of games) next[g.appid] = g;
                return next;
              });
            });
          };

          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(fetchGamesDeferred, { timeout: 1000 });
          } else {
            setTimeout(fetchGamesDeferred, 0);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    }

    // Start polling
    if (isVisible) {
      void tick();
      intervalId = setInterval(tick, pollInterval);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    appid,
    suggestions,
    missingAppIds.length,
    fetchGames,
    fetchSuggestions,
    triggerSuggestionGeneration,
  ]);

  useEffect(() => {
    if (!suggestions?.length) return;
    if (!missingAppIds.length) return;

    let cancelled = false;

    (async () => {
      const toIngest = missingAppIds
        .filter((id) => !requestedIngestRef.current.has(id))
        .slice(0, MAX_AUTO_INGEST);

      for (const id of toIngest) {
        if (cancelled) return;
        requestedIngestRef.current.add(id);
        try {
          await ingestGame(id);
        } catch {
          // Ignore; polling will keep trying to hydrate whatever eventually exists.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [suggestions, missingAppIds, ingestGame]);

  // Prefetch top suggestions (high click probability when user is engaged)
  // Must be before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (displayGames.length > 0) {
      const topSuggestions = displayGames.slice(0, PREFETCH_SUGGESTIONS_COUNT);
      topSuggestions.forEach((game) => {
        router.prefetch(`/games/${game.appid}`);
      });
    }
  }, [displayGames, router]);

  // Initial loading
  if (suggestions === null) {
    return <SuggestionsSkeleton showNotice={showSlowNotice} />;
  }

  // No suggestions yet (still generating / waiting)
  if (suggestions.length === 0) {
    if (generating) {
      return <SuggestionsSkeleton showNotice={showSlowNotice} count={4} />;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Games</CardTitle>
          <CardDescription>
            {generating
              ? "Generating recommendations… this may take a minute."
              : "No recommendations yet. Generate them to get started."}
          </CardDescription>
          {!generating && (
            <div className="pt-2">
              <Button onClick={() => void triggerSuggestionGeneration()}>
                Generate suggestions
              </Button>
            </div>
          )}
          {error && (
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    );
  }

  // Suggestions exist, but we might still be hydrating details.
  if (missingAppIds.length > 0) {
    return <SuggestionsSkeleton showNotice={showSlowNotice} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {displayGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {displayGames.map((game) => (
            <GameCard key={game.appid} {...game} />
          ))}
        </div>
      ) : (
        <SuggestionsSkeleton />
      )}

      {error && (
        <div className="text-sm text-destructive">
          {error}{" "}
          <button
            className="underline"
            onClick={() => {
              setError(null);
              requestedSuggestRef.current = false;
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
