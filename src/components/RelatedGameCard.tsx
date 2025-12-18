import Link from "next/link";
import Image from "next/image";
import type { RelatedGame } from "@/lib/supabase/types";

interface RelatedGameCardProps {
  game: RelatedGame;
}

export function RelatedGameCard({ game }: RelatedGameCardProps) {
  return (
    <Link href={`/games/${game.appid}`} className="block">
      <div>
        {game.header_image && (
          <Image
            src={game.header_image}
            alt={game.name}
            width={400}
            height={128}
            className="w-full h-32 object-cover mb-2"
            unoptimized
          />
        )}
        <div className="font-medium text-sm">{game.name}</div>
        <div className="text-xs text-muted-foreground">
          Similarity: {(game.similarity * 100).toFixed(1)}%
        </div>
      </div>
    </Link>
  );
}
