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
      // We already have the appId from search, so we can navigate right away
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

      // Navigate immediately - the game page will show loading state
      // and poll for data as it becomes available
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
      <nav className="sticky top-0 z-50 w-full border-b bg-[#c0c0c0] px-2 py-1 win95-outset mb-4">
        <div className="flex h-10 items-center gap-4 w-full">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 font-bold text-sm px-2 py-1 win95-button bg-[#c0c0c0]"
          >
            <Logo />
            <span>IndieFindr</span>
          </Link>

          {/* Search */}
          <div className="relative flex-1 max-w-xs ml-auto" ref={resultsRef}>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setShowResults(true);
                  }
                }}
                className="h-7 pr-8"
              />
              {searchQuery.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 hover:bg-transparent"
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
              <div className="fixed left-0 right-0 top-12 z-50 mt-0 max-h-[calc(100vh-3rem)] overflow-y-auto bg-[#c0c0c0] win95-outset sm:absolute sm:top-full sm:left-0 sm:right-0 sm:mt-1 sm:max-h-96">
                {searchQuery.trim().length < 2 ? (
                  <div className="p-4 text-center text-xs">
                    Keep typing to search…
                  </div>
                ) : isSearching ? (
                  <div className="p-4 text-center text-xs">
                    Searching...
                  </div>
                ) : dbResults.length > 0 || steamResults.length > 0 ? (
                  <div className="py-1">
                    {/* Database Results */}
                    {dbResults.length > 0 && (
                      <div className="border-b border-win95-grey mx-1 mb-1 pb-1">
                        {dbResults.map((game) => (
                          <button
                            key={`db-${game.appid}`}
                            onClick={() => handleResultClick(game)}
                            className="w-full flex items-center gap-3 px-2 py-1 text-left hover:bg-win95-blue hover:text-white transition-none text-xs"
                          >
                            <span className="flex-1 truncate">
                              {game.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Steam Results */}
                    {steamResults.map((game) => (
                      <button
                        key={`steam-${game.appid}`}
                        onClick={() => handleResultClick(game)}
                        disabled={ingestingAppId === game.appid}
                        className="w-full flex items-center gap-3 px-2 py-1 text-left hover:bg-win95-blue hover:text-white transition-none disabled:opacity-50 disabled:cursor-wait text-xs"
                      >
                        <span className="flex-1 truncate">
                          {game.title}
                        </span>
                        {ingestingAppId === game.appid ? (
                          <span className="text-[10px] opacity-70">
                            ...
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-70 italic">
                            (Steam)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="p-4 text-center text-xs">
                    No games found
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs">
                    Searching...
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
