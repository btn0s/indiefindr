import { Suspense } from "react";
import { RelatedGameCard } from "@/components/RelatedGameCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase/server";
import type { RelatedGame } from "@/lib/supabase/types";

interface RelatedGamesSectionProps {
  appid: string;
}

async function getRelatedGamesForFacet(
  appid: string,
  facet: string
): Promise<{ games: RelatedGame[]; hasEmbeddings: boolean }> {
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return { games: [], hasEmbeddings: false };
  }

  // Check if embeddings exist for this facet
  const { data: game } = await supabase
    .from("games")
    .select(`${facet}_embedding`)
    .eq("id", appId)
    .single();

  const hasEmbeddings = !!(game as Record<string, unknown> | null)?.[
    `${facet}_embedding`
  ];

  if (!hasEmbeddings) {
    return { games: [], hasEmbeddings: false };
  }

  const { data, error } = await supabase.rpc("get_related_games", {
    p_appid: appId,
    p_facet: facet,
    p_limit: 10,
    p_threshold: 0.55,
  });

  if (error) {
    console.error(`Error fetching ${facet} similar games:`, error);
    return { games: [], hasEmbeddings: true };
  }

  return { games: (data || []) as RelatedGame[], hasEmbeddings: true };
}

function RelatedGameCardSkeleton() {
  return (
    <div>
      <Skeleton className="w-full h-32 mb-2 rounded-md" />
      <Skeleton className="h-4 w-3/4 mb-1" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

function FacetLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <RelatedGameCardSkeleton />
      <RelatedGameCardSkeleton />
      <RelatedGameCardSkeleton />
    </div>
  );
}

function EmbeddingsPending() {
  return (
    <p className="text-muted-foreground text-sm">
      Embeddings still processing. Refresh to check again.
    </p>
  );
}

async function FacetContent({
  appid,
  facet,
}: {
  appid: string;
  facet: string;
}) {
  const { games, hasEmbeddings } = await getRelatedGamesForFacet(appid, facet);

  if (!hasEmbeddings) {
    return <EmbeddingsPending />;
  }

  if (games.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No similar games found.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((related) => (
        <RelatedGameCard key={related.appid} game={related} />
      ))}
    </div>
  );
}

export function RelatedGamesSection({ appid }: RelatedGamesSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Similar by Aesthetics</h2>
        <Suspense fallback={<FacetLoading />}>
          <FacetContent appid={appid} facet="aesthetic" />
        </Suspense>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Similar by Gameplay</h2>
        <Suspense fallback={<FacetLoading />}>
          <FacetContent appid={appid} facet="gameplay" />
        </Suspense>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Similar by Narrative/Mood</h2>
        <Suspense fallback={<FacetLoading />}>
          <FacetContent appid={appid} facet="narrative" />
        </Suspense>
      </div>
    </div>
  );
}
