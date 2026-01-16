import Link from "next/link";
import { GameCardAsync } from "./GameCardAsync";
import type { CollectionWithPreview } from "@/lib/supabase/types";

interface GameRowProps {
  collections: CollectionWithPreview[];
  getCollectionHref?: (collection: CollectionWithPreview) => string;
  viewMoreText?: string;
}

export function GameRow({ collections, getCollectionHref, viewMoreText = "View all →" }: GameRowProps) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      {collections.map((collection) => {
        const href = getCollectionHref
          ? getCollectionHref(collection)
          : `/collections/${collection.slug}`;
        return (
          <div key={collection.id} className="flex flex-col gap-4 w-full">
            <div className="container mx-auto max-w-4xl w-full flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <Link
                  href={href}
                  className="font-semibold text-xl hover:underline"
                  prefetch={true}
                >
                  {collection.title}
                </Link>
                {(collection.total_games_count ?? collection.preview_games.length) > 4 && (
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    prefetch={true}
                  >
                    {viewMoreText}
                  </Link>
                )}
              </div>
            {collection.description && (
              <p className="text-sm text-muted-foreground">
                {collection.description}
              </p>
            )}
          </div>
          <div className="container mx-auto max-w-4xl w-full">
            {collection.preview_games.length === 0 ? (
              <p className="text-muted-foreground">
                This collection doesn&apos;t have any games yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {collection.preview_games.map((game, index) => (
                  <GameCardAsync
                    key={game.appid}
                    appid={game.appid}
                    priority={index < 4}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
      })}
    </div>
  );
}
