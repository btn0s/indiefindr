import { ViewTransition } from "react";
import { GridSkeleton } from "@/components/CardSkeleton";
import { SkeletonCover } from "@/components/SkeletonCover";

/** The game page's own layout in outline: the cover plate, then (beside it on desktop) title, facts, blurb and Steam
 *  button, then the recommendation grid. Opened from a card, the card expands into it just as into the page (it has
 *  the same sheet, cover and title block, card-morph.ts); otherwise it fades in. It fades out under the page when that
 *  lands. */
export default function Loading() {
  return (
    <ViewTransition default="none" enter={{ "card-open": "none", default: "page-in" }} exit="skeleton-out">
    <main className="discovery-page" aria-busy="true" aria-label="Loading game">
      <div className="page-sheet" aria-hidden />
      <div className="source-game">
        <SkeletonCover />
        <div className="source-info">
          <div className="source-header">
            <div className="source-head">
              <div className="skeleton skeleton-lead" />
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-meta" />
            </div>
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
