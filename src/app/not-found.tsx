import Link from "next/link";
import { GameGrid } from "@/components/GameGrid";
import { ShelfHeading } from "@/components/ShelfHeading";
import { EmptyNote } from "@/components/EmptyNote";
import { getBrowsePage } from "@/lib/catalog";

export default async function NotFound() {
  const games = await getBrowsePage(0);

  return (
    <main className="discovery-page">
      <header className="page-head">
        <h1 className="page-title">Page not found</h1>
        <p className="page-note">This page doesn’t exist, or it moved. Search for a game above, or pick one below.</p>
        <div className="page-actions"><Link href="/" className="button button-secondary">Back to home</Link></div>
      </header>
      <section>
        <ShelfHeading title="Browse all" />
        {games.length ? <GameGrid initialGames={games} /> : <EmptyNote>The catalog is being updated. Please check back soon.</EmptyNote>}
      </section>
    </main>
  );
}
