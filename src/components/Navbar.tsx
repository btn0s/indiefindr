"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IngestForm } from "@/components/IngestForm";
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
  }, [searchQuery]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleResultClick = async (result: SearchResult) => {
    setSearchQuery("");
    setShowResults(false);

    if (result.inDatabase) {
      // Game exists in database, navigate directly
      router.push(`/games/${result.appid}`);
    } else {
      // Game doesn't exist, ingest it first
      setIngestingAppId(result.appid);
      setIngestingGame({
        title: result.title,
        image: result.header_image,
      });

      try {
        const steamUrl = `https://store.steampowered.com/app/${result.appid}/`;
        const response = await fetch("/api/games/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ steamUrl }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Update with actual game data if available
          setIngestingGame({
            title: data.title || result.title,
            image: data.steamData?.header_image || result.header_image,
          });
          router.push(`/games/${result.appid}`);
        } else {
          console.error("Failed to ingest game:", data.error);
          setIngestingGame(null);
          // Still navigate - the game might exist now or we'll show an error page
          router.push(`/games/${result.appid}`);
        }
      } catch (error) {
        console.error("Error ingesting game:", error);
        setIngestingGame(null);
        // Still navigate - the game might exist now or we'll show an error page
        router.push(`/games/${result.appid}`);
      } finally {
        setIngestingAppId(null);
      }
    }
  };

  return (
    <>
      <IngestingDialog
        open={!!ingestingGame}
        gameTitle={ingestingGame?.title}
        gameImage={ingestingGame?.image}
      />
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto max-w-4xl flex h-14 items-center gap-4 px-4 w-full">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            IndieFindr
          </Link>

          {/* Search */}
          <div className="relative flex-1" ref={resultsRef}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                className="pl-8"
              />
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto rounded-md border bg-background shadow-lg">
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
                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted transition-colors"
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
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-wait"
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

          {/* Add Game Button */}
          <Dialog>
            <DialogTrigger render={<Button>Add Game</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Game</DialogTitle>
                <DialogDescription>
                  Paste a Steam link to ingest game data and find similar games.
                </DialogDescription>
              </DialogHeader>
              <IngestForm />
            </DialogContent>
          </Dialog>
        </div>
      </nav>
    </>
  );
}
