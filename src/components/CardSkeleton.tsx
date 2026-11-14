/** Stands in for a GameCard at its exact size: art frame, title line, rating line. */
export function CardSkeleton() {
  return <div className="card-skeleton" aria-hidden="true">
    <div className="skeleton skeleton-art" />
    <div className="skeleton skeleton-line" />
    <div className="skeleton skeleton-line" />
  </div>;
}

export function GridSkeleton({ count }: { count: number }) {
  return <div className="game-grid">{Array.from({ length: count }, (_, index) => <CardSkeleton key={index} />)}</div>;
}
