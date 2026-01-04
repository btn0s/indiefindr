import Link from "next/link";
import Image from "next/image";
import type { CollectionWithPreview } from "@/lib/supabase/types";

interface CollectionCardProps {
  collection: CollectionWithPreview;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const { slug, title, description, preview_games } = collection;

  return (
    <Link
      href={`/collections/${slug}`}
      className="win95-card block group hover:translate-y-[-2px] transition-transform duration-200"
    >
      <div className="flex flex-col gap-3 p-2">
        <div>
          <h3 className="font-semibold text-base leading-tight group-hover:underline">{title}</h3>
          {description && (
            <p className="mt-1 text-[10px] text-[#404040] line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Preview games grid */}
        {preview_games.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {preview_games.map((game) => (
              <div
                key={game.appid}
                className="relative aspect-steam overflow-hidden rounded-sm bg-muted border border-black/5"
              >
                {game.header_image && (
                  <Image
                    src={game.header_image}
                    alt={game.title}
                    fill
                    sizes="(max-width: 640px) 33vw, 100px"
                    className="object-cover"
                  />
                )}
              </div>
            ))}
            {/* Fill empty slots if less than 3 games */}
            {preview_games.length < 3 &&
              Array.from({ length: 3 - preview_games.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-steam rounded-sm bg-muted/50 border border-black/5"
                />
              ))}
          </div>
        )}
      </div>
    </Link>
  );
}
