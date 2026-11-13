import { ShelfHeading } from "@/components/ShelfHeading";
import { GameCard } from "@/components/GameCard";
import type { CardGame } from "@/lib/catalog";

export function SameDeveloperSection({ developers, games }: { developers: string[]; games: CardGame[] }) {
  if (!games.length) return null;
  return (
    <section>
      <ShelfHeading title={`More from ${developers.length === 1 ? developers[0] : "these developers"}`}
        href={developers.length === 1 ? `/developer/${encodeURIComponent(developers[0])}` : undefined} />
      <div className="game-grid">
        {games.map(game => <GameCard key={game.appid} {...game} />)}
      </div>
    </section>
  );
}
