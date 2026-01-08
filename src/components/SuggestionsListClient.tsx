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
import { UI_CONFIG } from "@/lib/config";

const {
  CLIENT_MAX_AUTO_INGEST: MAX_AUTO_INGEST,
  SLOW_NOTICE_DELAY_MS: SLOW_NOTICE_MS,
  PREFETCH_SUGGESTIONS_COUNT,
  BATCH_FETCH_RETRY_DELAY_MS,
  BATCH_FETCH_MAX_RETRIES,
} = UI_CONFIG;

type SSEMessage =
  | { type: "suggestions"; suggestions: Suggestion[]; updatedAt: string }
  | { type: "complete" }
  | { type: "timeout" }
  | { type: "error"; message: string };

export function SuggestionsListClient({ appid }: { appid: number }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [gamesById, setGamesById] = useState<Record<number, GameNew>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);

  const requestedSuggestRef = useRef(false);
  const requestedIngestRef = useRef<Set<number>>(new Set());
  const fetchRetryCountRef = useRef<Map<number, number>>(new Map());
  const gamesByIdRef = useRef<Record<number, GameNew>>({});
  const generatingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const missingAppIds = useMemo(() => {
    if (!suggestions?.length) return [];
    return suggestions.map((s) => s.appId).filter((id) => !gamesById[id]);
  }, [suggestions, gamesById]);

  const displayGames = useMemo(() => {
    if (!suggestions?.length) return [];

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

  const fetchGames = useCallback(
    async (appIds: number[]): Promise<GameNew[]> => {
      if (!appIds.length) return [];
      const res = await fetch("/api/games/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appids: appIds }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { games?: GameNew[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || `Failed to load games (${res.status})`
        );
      }
      return json.data?.games || [];
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
    if (streamComplete) return;
    if (document.hidden) return;

    const eventSource = new EventSource(`/api/games/${appid}/suggestions/stream`);
    let closed = false;

    eventSource.onmessage = (event) => {
      if (closed) return;

      try {
        const data = JSON.parse(event.data) as SSEMessage;

        switch (data.type) {
          case "suggestions":
            setSuggestions(data.suggestions);
            if (data.suggestions.length === 0 && !generatingRef.current) {
              void triggerSuggestionGeneration();
            }
            break;
          case "complete":
            setStreamComplete(true);
            eventSource.close();
            break;
          case "timeout":
            setStreamComplete(true);
            eventSource.close();
            break;
          case "error":
            setError(data.message);
            break;
        }
      } catch {
        setError("Failed to parse server response");
      }
    };

    eventSource.onerror = () => {
      if (!closed) {
        eventSource.close();
        setStreamComplete(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        eventSource.close();
        closed = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      closed = true;
      eventSource.close();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [appid, streamComplete, triggerSuggestionGeneration]);

  useEffect(() => {
    if (!suggestions?.length) return;
    if (!missingAppIds.length) return;

    const toFetch = missingAppIds.filter((id) => {
      if (gamesByIdRef.current[id]) return false;
      const retries = fetchRetryCountRef.current.get(id) ?? 0;
      return retries < BATCH_FETCH_MAX_RETRIES;
    });

    if (toFetch.length === 0) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    const isFirstFetch = toFetch.every(
      (id) => !fetchRetryCountRef.current.has(id)
    );

    const doFetch = () => {
      toFetch.forEach((id) => {
        const current = fetchRetryCountRef.current.get(id) ?? 0;
        fetchRetryCountRef.current.set(id, current + 1);
      });

      void fetchGames(toFetch).then((games) => {
        setGamesById((prev) => {
          const next = { ...prev };
          for (const g of games) next[g.appid] = g;
          return next;
        });
      });
    };

    if (isFirstFetch) {
      doFetch();
    } else {
      fetchTimeoutRef.current = setTimeout(doFetch, BATCH_FETCH_RETRY_DELAY_MS);
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [suggestions, missingAppIds, fetchGames]);

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
        await ingestGame(id).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [suggestions, missingAppIds, ingestGame]);

  useEffect(() => {
    if (displayGames.length > 0) {
      const topSuggestions = displayGames.slice(0, PREFETCH_SUGGESTIONS_COUNT);
      topSuggestions.forEach((game) => {
        router.prefetch(`/games/${game.appid}`);
      });
    }
  }, [displayGames, router]);

  if (suggestions === null) {
    return <SuggestionsSkeleton showNotice={showSlowNotice} />;
  }

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
