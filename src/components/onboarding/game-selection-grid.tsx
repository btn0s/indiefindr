"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameImage } from "@/components/game-image";
import { Bookmark, BookmarkCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addToLibrary, removeFromLibrary } from "@/app/actions/library";
import { toast } from "sonner";
import Link from "next/link";
import type { SteamRawData } from "@/types/steam";

interface Game {
  id: number;
  title: string | null;
  steamAppid: string | null;
  descriptionShort: string | null;
  rawData?: SteamRawData | null;
  tags?: string[] | null;
}

interface GameSelectionGridProps {
  games: Game[];
}

export function GameSelectionGrid({ games }: GameSelectionGridProps) {
  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Game[]>([]);

  // Handle game selection/deselection
  const toggleGameSelection = async (gameId: number) => {
    const newSelectedGames = new Set(selectedGames);
    
    if (selectedGames.has(gameId)) {
      newSelectedGames.delete(gameId);
      setSelectedGames(newSelectedGames);
      
      try {
        await removeFromLibrary(gameId);
      } catch (error) {
        console.error("Error removing game from library:", error);
        toast.error("Failed to remove game from library");
        // Revert UI state if the action fails
        newSelectedGames.add(gameId);
        setSelectedGames(newSelectedGames);
      }
    } else {
      newSelectedGames.add(gameId);
      setSelectedGames(newSelectedGames);
      
      try {
        await addToLibrary(gameId);
        toast.success("Game added to your library!");
      } catch (error) {
        console.error("Error adding game to library:", error);
        toast.error("Failed to add game to library");
        // Revert UI state if the action fails
        newSelectedGames.delete(gameId);
        setSelectedGames(newSelectedGames);
      }
    }
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
      } else {
        toast.error("Search failed. Please try again.");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("An error occurred during search");
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and go back to suggested games
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Display either search results or suggested games
  const displayedGames = searchResults.length > 0 ? searchResults : games;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="search"
          placeholder="Search for games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isSearching}>
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>

      {searchResults.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Found {searchResults.length} results for "{searchQuery}"
          </p>
          <Button variant="ghost" size="sm" onClick={clearSearch}>
            Back to suggestions
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedGames.map((game) => (
          <Card key={game.id} className="overflow-hidden">
            <GameImage
              altText={game.title || "Game image"}
              gameData={game.rawData}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              variant="plain"
            />
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold line-clamp-1" title={game.title || ""}>
                  {game.title || "Unknown Game"}
                </h3>
                <Button
                  variant={selectedGames.has(game.id) ? "secondary" : "outline"}
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => toggleGameSelection(game.id)}
                  title={selectedGames.has(game.id) ? "Remove from library" : "Add to library"}
                >
                  {selectedGames.has(game.id) ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {game.descriptionShort && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {game.descriptionShort}
                </p>
              )}
              {game.tags && game.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {game.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-secondary px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {game.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{game.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {displayedGames.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No games found. Try a different search term.</p>
        </div>
      )}

      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Don't see games you like?
        </p>
        <Link href="/search" className="text-primary hover:underline text-sm">
          Browse all games
        </Link>
      </div>
    </div>
  );
}

