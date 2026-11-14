import type { CardGame } from "@/lib/catalog";
import { GameCard } from "./GameCard";
import { Rail } from "./Rail";

/** A rail of game cards. Renders nothing for an empty list. */
export function CardRail({ games, title, note, href, pageAppid }: {
  games: CardGame[]; title: string; note?: string; href?: string; pageAppid?: number;
}) {
  if (!games.length) return null;
  return <Rail title={title} note={note} href={href} pageAppid={pageAppid}>
    {games.map(game => <li key={game.appid}><GameCard {...game} /></li>)}
  </Rail>;
}
