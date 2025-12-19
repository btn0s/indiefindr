"use client";

import { useState, useMemo } from "react";
import GameCard from "@/components/GameCard";
import { GameNew } from "@/lib/supabase/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "suggested" | "title-asc" | "title-desc";

interface SortableSuggestionsGridProps {
  games: GameNew[];
  suggestedOrder: number[];
}

export function SortableSuggestionsGrid({
  games,
  suggestedOrder,
}: SortableSuggestionsGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>("suggested");

  const sortedGames = useMemo(() => {
    const gamesCopy = [...games];

    switch (sortBy) {
      case "title-asc":
        return gamesCopy.sort((a, b) =>
          (a.title || "").localeCompare(b.title || "")
        );
      case "title-desc":
        return gamesCopy.sort((a, b) =>
          (b.title || "").localeCompare(a.title || "")
        );
      case "suggested":
      default:
        // Sort by the order in suggestedOrder array
        const orderMap = new Map(
          suggestedOrder.map((appid, index) => [appid, index])
        );
        return gamesCopy.sort((a, b) => {
          const aOrder = orderMap.get(a.appid) ?? Infinity;
          const bOrder = orderMap.get(b.appid) ?? Infinity;
          return aOrder - bOrder;
        });
    }
  }, [games, sortBy, suggestedOrder]);

  if (games.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {games.length} game{games.length !== 1 ? "s" : ""}
        </p>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortOption)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="suggested">Suggested Order</SelectItem>
            <SelectItem value="title-asc">Title (A-Z)</SelectItem>
            <SelectItem value="title-desc">Title (Z-A)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {sortedGames.map((game) => (
          <GameCard key={game.appid} {...game} />
        ))}
      </div>
    </div>
  );
}
