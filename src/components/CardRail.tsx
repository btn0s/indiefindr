import type { CardGame } from "@/lib/catalog";
import { GameCard } from "./GameCard";
import { Rail } from "./Rail";

/** A rail of game cards, as store headers or (home's shelves) as box art. Renders nothing for an empty list. */
export function CardRail({ games, title, note, href, pageAppid, box = false }: {
  games: (CardGame & { cover?: string | null })[]; title: string; note?: string; href?: string; pageAppid?: number; box?: boolean;
}) {
  if (!games.length) return null;
  return <Rail title={title} note={note} href={href} pageAppid={pageAppid} box={box}>
    {games.map(game => <li key={game.appid}><GameCard {...game} box={box} /></li>)}
  </Rail>;
}
