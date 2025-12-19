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

export function Navbar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ appid: number; title: string; header_image: string | null }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Handle search input with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
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
          setSearchResults(data);
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

  const handleResultClick = (appid: number) => {
    setSearchQuery("");
    setShowResults(false);
    router.push(`/games/${appid}`);
  };

  return (
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
                if (searchResults.length > 0) {
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
              ) : searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((game) => (
                    <button
                      key={game.appid}
                      onClick={() => handleResultClick(game.appid)}
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
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Game
            </Button>
          </DialogTrigger>
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
  );
}
