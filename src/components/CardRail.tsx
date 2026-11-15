import type { CardGame } from "@/lib/catalog";
import { GameCard } from "./GameCard";
import { Rail } from "./Rail";

/** A rail of game cards, as store headers or (home's shelves) as box art. Renders nothing for an empty list. */
export function CardRail({ games, title, note, href, pageAppid, box = false, eager = 0 }: {
  games: (CardGame & { cover?: string | null })[]; title: string; note?: string; href?: string; pageAppid?: number; box?: boolean;
  /** How many leading cards load with the page (preloaded), for a rail on screen as it opens. */
  eager?: number;
}) {
  if (!games.length) return null;
  return <Rail title={title} note={note} href={href} pageAppid={pageAppid} box={box}>
    {games.map((game, index) => <li key={game.appid}><GameCard {...game} box={box} preload={index < eager} /></li>)}
  </Rail>;
}
