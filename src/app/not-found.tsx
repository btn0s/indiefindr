import { GameGrid } from "@/components/GameGrid";
import { ShelfHeading } from "@/components/ShelfHeading";
import { getBrowsePage } from "@/lib/catalog";

export default async function NotFound() {
  const games = await getBrowsePage(0);

  return (
    <main className="discovery-page">
      <header className="page-head">
        <h1 className="page-title">Page not found</h1>
        <p className="page-note">This page doesn&apos;t exist. Search for a game above, or browse below.</p>
      </header>
      <section>
        <ShelfHeading title="Browse all" />
        {games.length ? <GameGrid initialGames={games} /> : <p className="empty-note">The catalog is being updated. Please check back soon.</p>}
      </section>
    </main>
  );
}
