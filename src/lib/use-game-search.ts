"use client";
import { POPULAR_INDIES } from "./popular-indies";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { API_CONFIG } from "@/lib/config";

/** A search box row: the same shape /api/search returns to agents and the CLI. */
export type SearchGame = { appid: number; name: string; year: string | null; header_image: string | null; review_percent: number | null; review_count: number };

type PopularRow = { appid: number; title: string; header_image: string | null; release_date: string | null; review_positive_pct: number | null; review_count: number };

export function useGameSearch() {
  const sequence = useRef(0);
  const cache = useRef(new Map<string, SearchGame[]>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController>(undefined);
  const [games, setGames] = useState<SearchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { clearTimeout(timer.current); inflight.current?.abort(); }, []);

  const show = useCallback((id: number, results: SearchGame[]) => {
    if (id !== sequence.current) return;
    setGames(results); setLoading(false); setError("");
  }, []);

  // Curated empty-state picks load their artwork and ratings in one catalog lookup.
  const loadPopular = useCallback(async (id: number) => {
    const { data } = await getSupabaseBrowserClient().from("games")
      .select("appid,title,header_image,release_date,review_positive_pct,review_count")
      .in("appid", POPULAR_INDIES.map(game => game.appid))
      .returns<PopularRow[]>();
    const popular = POPULAR_INDIES.flatMap(pick => {
      const row = data?.find(game => game.appid === pick.appid);
      return row ? [{ appid: row.appid, name: row.title, year: row.release_date?.slice(0, 4) ?? null, header_image: row.header_image, review_percent: row.review_positive_pct, review_count: row.review_count }] : [];
    });
    cache.current.set("", popular);
    show(id, popular);
  }, [show]);

  const fetchResults = useCallback(async (id: number, key: string) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(key)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const { games: results } = await response.json() as { games: SearchGame[] };
      cache.current.set(key, results);
      show(id, results);
    } catch {
      if (controller.signal.aborted || id !== sequence.current) return;
      setError("Search is unavailable right now. Please try again."); setLoading(false);
    }
  }, [show]);

  const search = useCallback((query: string) => {
    const key = query.trim().toLowerCase().replace(/\s+/g, " ");
    const id = ++sequence.current;
    clearTimeout(timer.current);
    const cached = cache.current.get(key);
    if (cached) return show(id, cached);
    setLoading(true);
    if (!key) return void loadPopular(id);
    // Keep the previous rows on screen until the new ones arrive, so typing doesn't flash an empty list.
    timer.current = setTimeout(() => fetchResults(id, key), API_CONFIG.SEARCH_DEBOUNCE_MS);
  }, [show, loadPopular, fetchResults]);

  return { games, loading, error, search };
}
