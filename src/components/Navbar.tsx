"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IngestingDialog } from "@/components/IngestingDialog";

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
  const [showResults, setShowResults] = useState(false);
  const [ingestingAppId, setIngestingAppId] = useState<number | null>(null);
  const [ingestingGame, setIngestingGame] = useState<{
    title?: string;
    image?: string | null;
  } | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Handle search input with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setDbResults([]);
      setSteamResults([]);
      setShowResults(false);
      return;
    }

    if (searchQuery.trim().length < 2) {
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/games/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
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
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
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
      <nav className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="container mx-auto max-w-4xl flex h-14 items-center gap-3 px-4 w-full">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-base sm:text-lg"
          >
            IndieFindr
          </Link>

          {/* Search */}
          <div className="relative flex-1" ref={resultsRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (dbResults.length > 0 || steamResults.length > 0) {
                    setShowResults(true);
                  }
                }}
                className="h-10 pr-10 pl-9 sm:h-8"
              />
              {searchQuery.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => {
                    setSearchQuery("");
                    setDbResults([]);
                    setSteamResults([]);
                    setShowResults(false);
                  }}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="fixed left-0 right-0 top-14 z-50 mt-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b bg-background shadow-lg sm:absolute sm:top-full sm:left-0 sm:right-0 sm:mt-1 sm:max-h-96 sm:rounded-md sm:border">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : dbResults.length > 0 || steamResults.length > 0 ? (
                  <div className="py-1">
                    {/* Database Results */}
                    {dbResults.length > 0 && (
                      <>
                        {dbResults.map((game) => (
                          <button
                            key={`db-${game.appid}`}
                            onClick={() => handleResultClick(game)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors sm:py-2"
                          >
                            {game.header_image && (
                              <img
                                src={game.header_image}
                                alt={game.title}
                                className="h-12 w-20 object-cover rounded"
                              />
                            )}
                            <span className="flex-1 text-sm font-medium">
                              {game.title}
                            </span>
                          </button>
                        ))}
                        {steamResults.length > 0 && (
                          <div className="border-t my-1">
                            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
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
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-wait sm:py-2"
                      >
                        {game.header_image && (
                          <img
                            src={game.header_image}
                            alt={game.title}
                            className="h-12 w-20 object-cover rounded"
                          />
                        )}
                        <span className="flex-1 text-sm font-medium">
                          {game.title}
                        </span>
                        {ingestingAppId === game.appid ? (
                          <span className="text-xs text-muted-foreground">
                            Ingesting...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Add to database
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No games found
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
