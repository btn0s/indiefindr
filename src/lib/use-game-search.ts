"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type SearchGame = { appid: number; title: string };
export function useGameSearch() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const cache = useRef(new Map<string, SearchGame[]>());
  const lastQuery = useRef("");
  const [games, setGames] = useState<SearchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const engine = new Worker("/search-worker.js");
    worker.current = engine;
    engine.onmessage = ({ data }) => {
      if (data.type === "error") { setError("Search couldn't load. Please refresh and try again."); setLoading(false); }
      if (data.type === "results" && data.id === sequence.current) {
        cache.current.set(lastQuery.current, data.games);
        setGames(data.games); setLoading(false);
      }
    };
    engine.postMessage({ type: "load", url: "https://rqcqlpoxtdddjcylhopk.supabase.co/storage/v1/object/public/search/titles.json" });
    return () => { engine.terminate(); worker.current = null; };
  }, []);
  const search = useCallback((query: string) => {
    const key = query.trim().toLowerCase();
    lastQuery.current = key;
    const id = ++sequence.current;
    if (!key) { setGames([]); setLoading(false); return; }
    const cached = cache.current.get(key);
    if (cached) { setGames(cached); setLoading(false); return; }
    setGames([]); setLoading(true);
    worker.current?.postMessage({ type: "search", query: key, id });
  }, []);
  return { games, loading, error, search };
}
