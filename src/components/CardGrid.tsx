import type { GameCardGame } from "@/lib/supabase/types";
import { GameCard } from "./GameCard";
import { CardTracker } from "./CardTracker";

const CHUNK = 8;

/** A grid of game cards. Cards come in blocks of eight that skip layout and paint while off-screen
 *  (content-visibility), so long lists cost little until scrolled to. One tracker covers the whole grid. */
export function CardGrid({ games, pageAppid, eager = 0, ranked = false }: {
  games: (GameCardGame & { why?: string[] | null })[];
  /** The game page the grid sits on, for tracking. */
  pageAppid?: number;
  /** How many leading cards are on the first screen. */
  eager?: number;
  /** Track each card's place in the list. */
  ranked?: boolean;
}) {
  const blocks = Array.from({ length: Math.ceil(games.length / CHUNK) }, (_, index) => games.slice(index * CHUNK, (index + 1) * CHUNK));
  return <div className="card-grid">
    {blocks.map((block, blockIndex) => <div key={block[0].appid} className="game-grid">
      {block.map((game, index) => {
        const place = blockIndex * CHUNK + index;
        return <GameCard key={game.appid} {...game} preload={place < eager} position={ranked ? place + 1 : 0} />;
      })}
    </div>)}
    <CardTracker pageAppid={pageAppid} />
  </div>;
}
