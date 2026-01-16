"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, Bookmark, User, LogOut, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

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
          const json = await response.json();
          const data = json.data || json;
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
      setIngestingAppId(result.appid);

      // Start ingestion in background
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

      router.push(`/games/${result.appid}`);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background px-4">
        <div className="container mx-auto max-w-4xl flex h-14 items-center gap-3 w-full">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-base sm:text-lg"
          >
            <Logo />
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
                  if (searchQuery.trim().length > 0) {
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
                {searchQuery.trim().length < 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Keep typing to search…
                  </div>
                ) : isSearching ? (
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
                              <Image
                                src={game.header_image}
                                alt={game.title}
                                width={80}
                                height={48}
                                sizes="80px"
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
                          <Image
                            src={game.header_image}
                            alt={game.title}
                            width={80}
                            height={48}
                            sizes="80px"
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
                ) : hasSearched ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No games found
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <Link href="/saved">
                  <Button variant="ghost" size="sm" className="hidden sm:flex">
                    <Bookmark className="h-4 w-4" />
                    Saved
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus-visible:border-ring focus-visible:ring-ring/30 rounded-md border border-transparent bg-clip-padding text-xs/relaxed font-medium focus-visible:ring-2 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 outline-none h-7 w-7 hover:bg-muted hover:text-foreground">
                    <User className="h-4 w-4" />
                    <span className="sr-only">Account menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {user.email || "Account"}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/saved")}>
                      <Bookmark className="h-4 w-4" />
                      Saved games
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
  );
}
