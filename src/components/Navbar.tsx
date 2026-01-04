"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IngestingDialog } from "@/components/IngestingDialog";
import Logo from "@/components/logo";

interface SearchResult {
  appid: number;
  title: string;
  header_image: string | null;
  inDatabase: boolean;
}

export function Navbar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [steamResults, setSteamResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [ingestingAppId, setIngestingAppId] = useState<number | null>(null);
  const [ingestingGame, setIngestingGame] = useState<{
    title?: string;
    image?: string | null;
  } | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Handle search input with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancel any in-flight request when the query changes
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length === 0) {
      setDbResults([]);
      setSteamResults([]);
      setShowResults(false);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    // Show dropdown immediately as user types (snappier UX)
    setShowResults(true);

    if (trimmedQuery.length < 2) {
      setDbResults([]);
      setSteamResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    // Show loading immediately (even during debounce)
    setIsSearching(true);
    setHasSearched(false);

    const requestIdAtSchedule = requestIdRef.current;

    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/games/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );
        if (requestIdAtSchedule !== requestIdRef.current) {
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setDbResults(data.db || []);
          setSteamResults(data.steam || []);
          setShowResults(true);

          // Prefetch routes for database results (top 5) to make clicks instant
          const dbResultsToPrefetch = (data.db || []).slice(0, 5);
          dbResultsToPrefetch.forEach((game: SearchResult) => {
            router.prefetch(`/games/${game.appid}`);
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Search error:", error);
      } finally {
        if (requestIdAtSchedule !== requestIdRef.current) {
          return;
        }
        setIsSearching(false);
        setHasSearched(true);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, router]);

  // Close results when clicking outside
  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, []);

  const handleResultClick = async (result: SearchResult) => {
    setSearchQuery("");
    setShowResults(false);

    if (result.inDatabase) {
      // Game exists in database, navigate directly
      router.push(`/games/${result.appid}`);
    } else {
      // Game doesn't exist, start ingestion and navigate immediately
      setIngestingAppId(result.appid);
      setIngestingGame({
        title: result.title,
        image: result.header_image,
      });

      // Start ingestion in background (don't await)
      const steamUrl = `https://store.steampowered.com/app/${result.appid}/`;
      fetch("/api/games/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl }),
      })
        .then((response) => response.json())
        .catch((error) => {
          console.error("Error ingesting game:", error);
        })
        .finally(() => {
          setIngestingAppId(null);
          setIngestingGame(null);
        });

      router.push(`/games/${result.appid}`);
    }
  };

  return (
    <>
      <IngestingDialog
        open={!!ingestingGame}
        gameTitle={ingestingGame?.title}
        gameImage={ingestingGame?.image}
      />
      <nav className="sticky top-0 z-50 w-full border-b-2 border-[#333] bg-[#0a0a0a] bevel-up">
        <div className="container mx-auto max-w-5xl flex h-16 items-center gap-4 px-4 w-full">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-display text-xl uppercase tracking-widest text-[#00ffcc] hover:text-white transition-colors"
          >
            <Logo />
            IndieFindr
            <span className="text-[10px] bg-[#333] px-1 text-white hidden sm:inline-block">BETA</span>
          </Link>

          {/* Search */}
          <div className="relative flex-1" ref={resultsRef}>
            <div className="relative flex items-center">
              <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center pl-2 pointer-events-none">
                 <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="text"
                placeholder="SEARCH_GAMES..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setShowResults(true);
                  }
                }}
                className="pl-8"
              />
              {searchQuery.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 h-6 w-6"
                  onClick={() => {
                    setSearchQuery("");
                    setDbResults([]);
                    setSteamResults([]);
                    setShowResults(false);
                  }}
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0a0a0a] bevel-up border border-[#333] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
                {searchQuery.trim().length < 2 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground font-mono">
                    AWAITING INPUT...
                  </div>
                ) : isSearching ? (
                  <div className="p-4 text-center text-xs text-[#00ffcc] font-mono animate-pulse">
                    SEARCHING_DATABASE...
                  </div>
                ) : dbResults.length > 0 || steamResults.length > 0 ? (
                  <div className="py-1">
                    {/* Database Results */}
                    {dbResults.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] text-[#888] uppercase tracking-widest border-b border-[#222]">
                          In Database
                        </div>
                        {dbResults.map((game) => (
                          <button
                            key={`db-${game.appid}`}
                            onClick={() => handleResultClick(game)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#222] transition-colors group"
                          >
                            {game.header_image && (
                              <Image
                                src={game.header_image}
                                alt={game.title}
                                width={80}
                                height={48}
                                sizes="80px"
                                className="h-8 w-14 object-cover border border-[#333] group-hover:border-[#00ffcc]"
                              />
                            )}
                            <span className="flex-1 text-xs font-bold text-[#e0e0e0] group-hover:text-[#00ffcc] font-sans">
                              {game.title}
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                    
                    {/* Steam Results */}
                    {steamResults.length > 0 && (
                      <>
                         <div className="px-2 py-1 text-[10px] text-[#888] uppercase tracking-widest border-b border-[#222] border-t mt-1">
                          Steam Store
                        </div>
                        {steamResults.map((game) => (
                          <button
                            key={`steam-${game.appid}`}
                            onClick={() => handleResultClick(game)}
                            disabled={ingestingAppId === game.appid}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-wait group"
                          >
                            {game.header_image && (
                              <Image
                                src={game.header_image}
                                alt={game.title}
                                width={80}
                                height={48}
                                sizes="80px"
                                className="h-8 w-14 object-cover border border-[#333] group-hover:border-[#ff00ff]"
                              />
                            )}
                            <span className="flex-1 text-xs font-bold text-[#aaa] group-hover:text-[#ff00ff] font-sans">
                              {game.title}
                            </span>
                            {ingestingAppId === game.appid ? (
                              <span className="text-[10px] text-[#00ffcc] font-mono animate-pulse">
                                [INGESTING]
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#666] group-hover:text-[#ff00ff] font-mono">
                                [ADD]
                              </span>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                ) : hasSearched ? (
                  <div className="p-4 text-center text-xs text-[#ff3333] font-mono">
                    NO_DATA_FOUND
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#00ffcc] font-mono animate-pulse">
                    SEARCHING...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
