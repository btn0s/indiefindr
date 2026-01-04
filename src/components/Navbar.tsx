"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
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

      // Start ingestion in background (don't await)
      const steamUrl = `https://store.steampowered.com/app/${result.appid}/`;
      fetch("/api/games/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl, skipSuggestions: true }),
        keepalive: true,
      })
        .then((response) => response.json())
        .catch((error) => {
          console.error("Error ingesting game:", error);
        })
        .finally(() => {
          setIngestingAppId(null);
        });

      // Navigate immediately - the game page will show loading state
      // and poll for data as it becomes available
      router.push(`/games/${result.appid}`);
    }
  };

  return (
    <nav className="cartridge-console fixed top-0 left-0 right-0 z-50 w-full">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex h-16 items-center gap-4 w-full">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-base sm:text-lg text-[#000000] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]"
          >
            <Logo />
            IndieFindr
          </Link>

          {/* Search - Cartridge Slot */}
          <div className="relative flex-1" ref={resultsRef}>
            <div className="cartridge-slot relative">
              <div className="cartridge-slot-inset">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060] pointer-events-none z-10 transition-colors duration-200" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) {
                      setShowResults(true);
                    }
                  }}
                  className="win95-input h-10 pr-9 pl-9 sm:h-9 w-full text-sm text-[#000000] placeholder:text-[#808080]"
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    className="cartridge-eject-button absolute right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 flex items-center justify-center rounded-sm"
                    onClick={() => {
                      setSearchQuery("");
                      setDbResults([]);
                      setSteamResults([]);
                      setShowResults(false);
                    }}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3 text-[#000000]" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Dropdown - Cartridge Tray */}
            {showResults && (
              <div className="cartridge-tray fixed left-0 right-0 top-16 z-50 mt-2 max-h-[calc(100vh-4rem)] overflow-y-auto sm:absolute sm:top-full sm:left-0 sm:right-0 sm:mt-2 sm:max-h-96">
                {searchQuery.trim().length < 2 ? (
                  <div className="px-2 py-1.5 text-center text-xs text-[#404040]">
                    Keep typing to search…
                  </div>
                ) : isSearching ? (
                  <div className="px-2 py-1.5 text-center text-xs text-[#404040]">
                    Searching...
                  </div>
                ) : dbResults.length > 0 || steamResults.length > 0 ? (
                  <div className="py-1 px-1">
                    {/* Database Results */}
                    {dbResults.length > 0 && (
                      <>
                        {dbResults.map((game) => (
                          <button
                            key={`db-${game.appid}`}
                            onClick={() => handleResultClick(game)}
                            className="cartridge-result-item w-full flex items-center gap-2 px-2 py-1.5 text-left"
                          >
                            {game.header_image && (
                              <Image
                                src={game.header_image}
                                alt={game.title}
                                width={80}
                                height={48}
                                sizes="80px"
                                className="h-12 w-20 object-cover rounded-sm"
                              />
                            )}
                            <span className="flex-1 text-xs font-medium text-[#000000]">
                              {game.title}
                            </span>
                          </button>
                        ))}
                        {steamResults.length > 0 && (
                          <div className="cartridge-divider my-1">
                            <div className="px-2 py-1.5 text-xs font-semibold text-[#404040] uppercase">
                              Steam Store
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {/* Steam Results */}
                    {steamResults.map((game) => (
                      <button
                        key={`steam-${game.appid}`}
                        onClick={() => handleResultClick(game)}
                        disabled={ingestingAppId === game.appid}
                        className="cartridge-result-item w-full flex items-center gap-2 px-2 py-1.5 text-left disabled:opacity-50 disabled:cursor-wait"
                      >
                        {game.header_image && (
                          <Image
                            src={game.header_image}
                            alt={game.title}
                            width={80}
                            height={48}
                            sizes="80px"
                            className="h-12 w-20 object-cover rounded-sm"
                          />
                        )}
                        <span className="flex-1 text-xs font-medium text-[#000000]">
                          {game.title}
                        </span>
                        {ingestingAppId === game.appid ? (
                          <span className="text-xs text-[#404040]">
                            Ingesting...
                          </span>
                        ) : (
                          <span className="text-xs text-[#404040]">
                            Add to database
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="px-2 py-1.5 text-center text-xs text-[#404040]">
                    No games found
                  </div>
                ) : (
                  <div className="px-2 py-1.5 text-center text-xs text-[#404040]">
                    Searching...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
