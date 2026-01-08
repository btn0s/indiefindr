import Link from "next/link";
import Image from "next/image";
import { getOrFetchGame } from "@/lib/actions/games";

interface GameCardAsyncProps {
  appid: number;
  explanation?: string;
}

export async function GameCardAsync({ appid, explanation }: GameCardAsyncProps) {
  const game = await getOrFetchGame(appid);

  if (!game) {
    return (
      <div>
        <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Game not found</span>
        </div>
        <div className="font-medium text-sm text-muted-foreground">
          Unknown Game
        </div>
        {explanation && (
          <div className="text-xs text-muted-foreground first-letter:uppercase">
            {explanation}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={`/games-new/${game.appid}`} className="block" prefetch={false}>
      <div>
        <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam">
          {game.header_image && (
            <Image
              src={game.header_image}
              alt={game.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>
        <div className="font-medium text-sm">{game.title}</div>
        {explanation && (
          <div className="text-xs text-muted-foreground first-letter:uppercase">
            {explanation}
          </div>
        )}
      </div>
    </Link>
  );
}
