import Link from "next/link";
import { Flame } from "lucide-react";
import { compactCount, steamRating } from "@/lib/rating";
import { reviewBomb, type ReviewQuality } from "@/lib/review-quality";

type FactsGame = ReviewQuality & {
  title: string;
  developers: string[];
  release_date: string | null;
  review_positive_pct: number | null;
  review_count: number;
  is_indie: boolean;
};

const monthYear = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** The game's facts in one row of quiet chips: rating, review count, developer, year (the Steam button carries
 *  the price). A missing fact leaves no
 *  gap or punctuation behind, and the chips wrap whole. */
export function GameFacts({ game }: { game: FactsGame }) {
  const rating = steamRating(game.review_positive_pct, game.review_count);
  const year = game.release_date?.slice(0, 4);
  const bomb = reviewBomb(game);
  const when = bomb ? monthYear(bomb.when.start) : "";
  return <>
    <ul className="game-facts">
      {rating && <li title="Steam user reviews"><strong>{game.review_positive_pct}%</strong> {rating}</li>}
      {game.review_count > 0 && <li>{compactCount(game.review_count)}{"\u00a0"}reviews</li>}
      {game.developers.map(developer => <li key={developer}>
        <Link title={developer} href={game.is_indie ? `/developer/${encodeURIComponent(developer)}` : `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`}>{developer}</Link>
      </li>)}
      {year && <li><time dateTime={game.release_date!}>{year}</time></li>}
    </ul>
    {bomb && <div className="bomb-readout">
      <p className="bomb-copy">
        <Flame className="bomb-icon" aria-hidden="true" />
        <span>
          {bomb.active
            ? <>Rated <strong>{bomb.ratingBefore.pct}% {bomb.ratingBefore.label}</strong> before an ongoing review bomb.</>
            : <>Rated <strong>{bomb.ratingBefore.pct}% {bomb.ratingBefore.label}</strong> before a review bomb in {when}.</>}
        </span>
      </p>
      <a
        className="bomb-link"
        href={`https://www.google.com/search?q=${encodeURIComponent(`${game.title} review bomb ${when}`)}`}
        target="_blank"
        rel="noopener"
      >
        Learn more{"\u00a0"}<span aria-hidden="true">↗</span>
      </a>
    </div>}
  </>;
}
