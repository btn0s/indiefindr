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
        <div key={collection.id} className="flex flex-col gap-4 w-full">
          <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Link
                href={`/collections/${collection.slug}`}
                className="font-semibold text-xl hover:underline"
              >
                {collection.title}
              </Link>
              {collection.description && (
                <p className="text-sm text-muted-foreground">
                  {collection.description}
                </p>
              )}
            </div>
            <Link
              href={`/collections/${collection.slug}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              View all →
            </Link>
          </div>
          <div className="container mx-auto max-w-4xl w-full">
            {collection.preview_games.length === 0 ? (
              <p className="text-muted-foreground">
                This collection doesn&apos;t have any games yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {collection.preview_games.map((game) => (
                  <GameCard key={game.appid} {...game} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
