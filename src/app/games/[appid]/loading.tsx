import { GridSkeleton } from "@/components/CardSkeleton";

/** The game page's own layout in outline: the key art plate, then title, facts, blurb and Steam button, then the
 *  recommendation grid. */
export default function Loading() {
  return (
    <main className="discovery-page" aria-busy="true" aria-label="Loading game">
      <div className="source-game">
        <div className="game-hero" />
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
        <GridSkeleton count={12} />
      </section>
    </main>
  );
}
