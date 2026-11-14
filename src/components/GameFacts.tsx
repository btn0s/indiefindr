import Link from "next/link";
import { compactCount, steamRating } from "@/lib/rating";

type FactsGame = {
  developers: string[];
  release_date: string | null;
  review_positive_pct: number | null;
  review_count: number;
  is_indie: boolean;
};

/** The game's facts: rating, review count, each developer, year (the Steam button carries the price). Each fact is a
 *  value and a label; the label names what the value is, and the page's visual language decides how much of it shows.
 *  A missing fact leaves no gap behind, and nothing truncates. */
export function GameFacts({ game }: { game: FactsGame }) {
  const rating = steamRating(game.review_positive_pct, game.review_count);
  const year = game.release_date?.slice(0, 4);
  return <ul className="game-facts">
    {rating && <li data-fact="score" title="Steam user reviews"><span className="fact-value">{game.review_positive_pct}%</span> <span className="fact-label">{rating}</span></li>}
    {game.review_count > 0 && <li data-fact="reviews"><span className="fact-value">{compactCount(game.review_count)}</span>{" "}<span className="fact-label">reviews</span></li>}
    {game.developers.map(developer => <li key={developer} data-fact="developer">
      <span className="fact-value"><Link title={developer} href={game.is_indie ? `/developer/${encodeURIComponent(developer)}` : `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`}>{developer}</Link></span>
      <span className="fact-label" data-quiet>Developer</span>
    </li>)}
    {year && <li data-fact="year"><span className="fact-value"><time dateTime={game.release_date!}>{year}</time></span> <span className="fact-label" data-quiet>Released</span></li>}
  </ul>;
}
