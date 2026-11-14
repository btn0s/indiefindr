import { ViewTransition } from "react";
import { GridSkeleton } from "@/components/CardSkeleton";

/** The game page's own layout in outline: the cover plate, then (beside it on desktop) title, facts, blurb and Steam
 *  button, then the recommendation grid.
 *  It arrives the way the page would (sliding in from a card) and fades out under the page when that lands. */
export default function Loading() {
  return (
    <ViewTransition default="none" enter={{ "nav-forward": "slide-from-right", default: "none" }} exit="skeleton-out">
    <main className="discovery-page" aria-busy="true" aria-label="Loading game">
      <div className="source-game">
        <div className="game-trailer" />
        <div className="source-info">
          <div className="source-header">
            <div className="skeleton skeleton-lead" />
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-meta" />
            <div className="skeleton-text">
              <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
            </div>
          </div>
          <div className="skeleton skeleton-button" />
        </div>
      </div>
      <section>
        <div className="section-heading"><div className="skeleton skeleton-heading" /></div>
        <GridSkeleton count={8} />
      </section>
    </main>
    </ViewTransition>
  );
}
