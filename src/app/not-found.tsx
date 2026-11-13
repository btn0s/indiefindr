import { GameGrid } from "@/components/GameGrid";
import { getBrowsePage } from "@/lib/catalog";

export default async function NotFound() {
  const games = await getBrowsePage(0);

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2 py-8">
        <h1 className="text-4xl font-semibold tracking-tight">Not Found</h1>
        <p className="text-muted-foreground">
          This page doesn&apos;t exist. Browse games below or search for
          something else.
        </p>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Discover Games</h2>
        {games.length === 0 ? (
          <p className="text-muted-foreground">
            The catalog is being updated. Please check back soon.
          </p>
        ) : (
          <GameGrid initialGames={games} />
        )}
      </div>
    </main>
  );
}
