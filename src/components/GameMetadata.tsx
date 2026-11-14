import Link from "next/link";
import { compactCount, steamRating } from "@/lib/rating";
import {
  adjustedNote,
  bombSpans,
  shownScore,
  type ReviewQuality,
} from "@/lib/review-quality";
import type { ReviewHistory } from "@/lib/review-history";
import {
  ReviewStory,
  ReviewStoryPanel,
  ReviewStoryTrigger,
} from "./ReviewStory";

type MetadataGame = ReviewQuality & {
  title: string;
  developers: string[];
  release_date: string | null;
  review_positive_pct: number | null;
  review_count: number;
  is_indie: boolean;
};

/**
 * Optional facts wrap as complete items; missing facts leave no punctuation behind.
 * A review-bombed game shows its adjusted score, with a note under it that opens the story.
 */
export function GameMetadata({
  game,
  history = null,
}: {
  game: MetadataGame;
  history?: ReviewHistory | null;
}) {
  const { pct: score, rescued } = shownScore(game);
  const rating = steamRating(score, game.review_count);
  const date = game.release_date ? new Date(game.release_date) : null;
  const hasDate = date && !Number.isNaN(date.getTime());
  if (!rating && !game.review_count && !hasDate && !game.developers.length)
    return null;
  const spans = rescued ? bombSpans(game.bomb_windows) : [];
  const facts = (
    <div className="game-meta">
      {rating && (
        <span
          className="meta-score"
          title={rescued ? undefined : "Steam user reviews"}
        >
          <strong>{score}%</strong> {rating}
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
      {rescued && (
        <ReviewStoryTrigger>
          {adjustedNote(spans)}. Steam shows {game.review_positive_pct}%.
        </ReviewStoryTrigger>
      )}
    </div>
  );
  if (!rescued) return facts;
  return (
    <ReviewStory>
      {facts}
      <ReviewStoryPanel
        title={game.title}
        steamScore={game.review_positive_pct!}
        cleanScore={score!}
        spans={spans}
        history={history}
      />
    </ReviewStory>
  );
}
