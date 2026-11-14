import { GridSkeleton } from "./CardSkeleton";

/** A list page in outline: title, one-line note, a grid of cards. */
export function ListPageSkeleton() {
  return (
    <main className="discovery-page" aria-busy="true" aria-label="Loading games">
      <div className="page-head">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-note" />
      </div>
      <GridSkeleton count={12} />
    </main>
  );
}
