"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type SearchGame = { appid: number; title: string };
/** What a result row shows beyond its title. The title index stays small; the visible rows fetch this. */
export type SearchDetail = { appid: number; header_image: string | null; release_date: string | null; review_positive_pct: number | null; review_count: number };

export function useGameSearch() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const cache = useRef(new Map<string, SearchGame[]>());
  const lastQuery = useRef("");
  const requested = useRef(new Set<number>());
  // The title index is several megabytes, so it downloads the first time someone searches, not on every page view.
  const loaded = useRef(false);
  const [games, setGames] = useState<SearchGame[]>([]);
  const [details, setDetails] = useState<Map<number, SearchDetail>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = useCallback(async (results: SearchGame[]) => {
    const missing = results.map(game => game.appid).filter(appid => !requested.current.has(appid));
    if (!missing.length) return;
    missing.forEach(appid => requested.current.add(appid));
    const { data } = await getSupabaseBrowserClient().from("games")
      .select("appid,header_image,release_date,review_positive_pct,review_count").in("appid", missing).returns<SearchDetail[]>();
    if (data?.length) setDetails(previous => new Map([...previous, ...data.map(row => [row.appid, row] as const)]));
  }, []);

  const show = useCallback((results: SearchGame[]) => {
    setGames(results); setLoading(false); loadDetails(results);
  }, [loadDetails]);

  useEffect(() => {
    const engine = new Worker("/search-worker.js");
    worker.current = engine;
    engine.onmessage = ({ data }) => {
      if (data.type === "error") { setError("Search couldn't load. Please refresh and try again."); setLoading(false); }
      if (data.type === "results" && data.id === sequence.current) {
        cache.current.set(lastQuery.current, data.games);
        show(data.games);
      }
    };
    return () => { engine.terminate(); worker.current = null; loaded.current = false; };
  }, [show]);

  // The empty search shows the most-reviewed indies, with their row details in the same query.
  const loadPopular = useCallback(async (id: number) => {
    const { data } = await getSupabaseBrowserClient().from("games")
      .select("appid,title,header_image,release_date,review_positive_pct,review_count")
      .eq("is_indie", true).order("review_count", { ascending: false }).limit(8)
      .returns<(SearchDetail & { title: string })[]>();
    const rows = data ?? [];
    rows.forEach(row => requested.current.add(row.appid));
    setDetails(previous => new Map([...previous, ...rows.map(row => [row.appid, row] as const)]));
    const popular = rows.map(({ appid, title }) => ({ appid, title }));
    cache.current.set("", popular);
    if (id === sequence.current) show(popular);
  }, [show]);

  const search = useCallback((query: string) => {
    if (!loaded.current && worker.current) {
      loaded.current = true;
      worker.current.postMessage({ type: "load", url: "https://rqcqlpoxtdddjcylhopk.supabase.co/storage/v1/object/public/search/titles.json" });
    }
    const key = query.trim().toLowerCase();
    lastQuery.current = key;
    const id = ++sequence.current;
    const cached = cache.current.get(key);
    if (cached) return show(cached);
    setLoading(true);
    if (!key) return void loadPopular(id);
    // Keep the previous rows on screen until the new ones arrive, so typing doesn't flash an empty list.
    worker.current?.postMessage({ type: "search", query: key, id });
  }, [show, loadPopular]);

  return { games, details, loading, error, search };
}
