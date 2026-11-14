import Link from "next/link";
import { compactCount, steamRating } from "@/lib/rating";

type FactsGame = {
  developers: string[];
  release_date: string | null;
  review_positive_pct: number | null;
  review_count: number;
  is_indie: boolean;
};

/** The game's facts in one row of quiet chips: rating, review count, price, developer, year. A missing fact leaves no
 *  gap or punctuation behind, and the chips wrap whole. */
export function GameFacts({ game, price }: { game: FactsGame; price: string | null }) {
  const rating = steamRating(game.review_positive_pct, game.review_count);
  const year = game.release_date?.slice(0, 4);
  return <ul className="game-facts">
    {rating && <li title="Steam user reviews"><strong>{game.review_positive_pct}%</strong> {rating}</li>}
    {game.review_count > 0 && <li>{compactCount(game.review_count)} reviews</li>}
    {price && <li>{price}</li>}
    {game.developers.map(developer => <li key={developer}>
      <Link href={game.is_indie ? `/developer/${encodeURIComponent(developer)}` : `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`}>{developer}</Link>
    </li>)}
    {year && <li><time dateTime={game.release_date!}>{year}</time></li>}
  </ul>;
}
