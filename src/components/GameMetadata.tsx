import Link from "next/link";
import { compactCount, steamRating } from "@/lib/rating";

type MetadataGame = {
  developers: string[];
  release_date: string | null;
  review_positive_pct: number | null;
  review_count: number;
  is_indie: boolean;
};

/** Optional facts wrap as complete items; missing facts leave no punctuation behind. */
export function GameMetadata({ game }: { game: MetadataGame }) {
  const rating = steamRating(game.review_positive_pct, game.review_count);
  const date = game.release_date ? new Date(game.release_date) : null;
  const hasDate = date && !Number.isNaN(date.getTime());
  if (!rating && !game.review_count && !hasDate && !game.developers.length)
    return null;
  return (
    <div className="game-meta">
      {rating && (
        <span className="meta-score" title="Steam user reviews">
          <strong>{game.review_positive_pct}%</strong> {rating}
        </span>
      )}
      {game.review_count > 0 && (
        <span>{compactCount(game.review_count)} reviews</span>
      )}
      {hasDate && (
        <span>
          <span className="meta-label">Released</span>
          <time dateTime={game.release_date!}>
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </span>
      )}
      {game.developers.map((developer) => (
        <span key={developer}>
          <span className="meta-label">Developer</span>
          <Link
            href={
              game.is_indie
                ? `/developer/${encodeURIComponent(developer)}`
                : `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`
            }
          >
            {developer}
          </Link>
        </span>
      ))}
    </div>
  );
}
