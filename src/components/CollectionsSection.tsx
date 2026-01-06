import Link from "next/link";
import GameCard from "./GameCard";
import type { CollectionWithPreview } from "@/lib/supabase/types";

interface CollectionsSectionProps {
  collections: CollectionWithPreview[];
  title?: string;
}

export function CollectionsSection({
  collections,
  title = "Featured Collections",
}: CollectionsSectionProps) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      {collections.map((collection) => (
        <div key={collection.id} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <Link
                href={`/collections/${collection.slug}`}
                className="font-semibold text-lg text-[#000000] hover:underline"
              >
                {collection.title}
              </Link>
              {(collection.total_games_count ?? collection.preview_games.length) > 4 && (
                <Link
                  href={`/collections/${collection.slug}`}
                  className="text-xs text-[#404040] hover:text-[#000000] transition-colors whitespace-nowrap"
                >
                  View all →
                </Link>
              )}
            </div>
            {collection.description && (
              <p className="text-xs text-[#404040]">
                {collection.description}
              </p>
            )}
          </div>
          {collection.preview_games.length === 0 ? (
            <p className="text-[#404040] text-sm">
              This collection doesn&apos;t have any games yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {collection.preview_games.map((game) => (
                <GameCard key={game.appid} {...game} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
