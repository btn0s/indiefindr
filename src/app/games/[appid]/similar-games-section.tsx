"use client";

import { useState, useEffect, useTransition } from "react";
import { GameCard } from "@/components/GameCard";
import { cn } from "@/lib/utils";
import { FACET_CONFIGS, type FacetType } from "@/lib/embeddings/types";

// =============================================================================
// TYPES
// =============================================================================

interface SimilarGame {
  appid: number;
  title: string;
  header_image: string | null;
  similarity: number;
}

interface SimilarGamesResponse {
  games: SimilarGame[];
  facet: FacetType | "all";
}

// =============================================================================
// FACET TABS
// =============================================================================

const FACET_TABS: Array<{
  id: FacetType | "all";
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "All",
    description: "Balanced match across all facets",
  },
  {
    id: "aesthetic",
    label: FACET_CONFIGS.aesthetic.label,
    description: FACET_CONFIGS.aesthetic.description,
  },
  {
    id: "mechanics",
    label: FACET_CONFIGS.mechanics.label,
    description: FACET_CONFIGS.mechanics.description,
  },
  {
    id: "narrative",
    label: FACET_CONFIGS.narrative.label,
    description: FACET_CONFIGS.narrative.description,
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function SimilarGamesSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
          <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function FacetTabs({
  activeFacet,
  onFacetChange,
  isPending,
}: {
  activeFacet: FacetType | "all";
  onFacetChange: (facet: FacetType | "all") => void;
  isPending: boolean;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FACET_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onFacetChange(tab.id)}
          disabled={isPending}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            "border border-transparent",
            activeFacet === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
            isPending && "opacity-50 cursor-not-allowed"
          )}
          title={tab.description}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SimilarGamesGrid({ games }: { games: SimilarGame[] }) {
  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No similar games found for this facet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {games.map((game) => (
        <GameCard
          key={game.appid}
          appid={game.appid}
          title={game.title}
          header_image={game.header_image}
          explanation={`${Math.round(game.similarity * 100)}% match`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SimilarGamesSection({
  appId,
  gameTitle,
  initialFacet = "all",
}: {
  appId: number;
  gameTitle: string;
  initialFacet?: FacetType | "all";
}) {
  const [activeFacet, setActiveFacet] = useState<FacetType | "all">(initialFacet);
  const [games, setGames] = useState<SimilarGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch similar games when facet changes
  useEffect(() => {
    async function fetchSimilarGames() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          facet: activeFacet,
          limit: "12",
        });

        const response = await fetch(`/api/games/${appId}/similar?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch similar games");
        }

        const data: SimilarGamesResponse = await response.json();
        setGames(data.games);
      } catch (err) {
        console.error("Error fetching similar games:", err);
        setError("Failed to load similar games");
        setGames([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSimilarGames();
  }, [appId, activeFacet]);

  const handleFacetChange = (facet: FacetType | "all") => {
    startTransition(() => {
      setActiveFacet(facet);
    });
  };

  const currentTab = FACET_TABS.find((t) => t.id === activeFacet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Games like {gameTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {currentTab?.description}
          </p>
        </div>
        <FacetTabs
          activeFacet={activeFacet}
          onFacetChange={handleFacetChange}
          isPending={isPending}
        />
      </div>

      {isLoading ? (
        <SimilarGamesSkeleton />
      ) : error ? (
        <div className="text-center py-8 text-destructive">{error}</div>
      ) : (
        <SimilarGamesGrid games={games} />
      )}
    </div>
  );
}
