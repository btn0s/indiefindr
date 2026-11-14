import { ShelfHeading } from "@/components/ShelfHeading";
import type { CardGame } from "@/lib/catalog";
import { CardGrid } from "@/components/CardGrid";
import { EmptyNote } from "@/components/EmptyNote";

export function SuggestionsSection({ appId, games }: { appId: number; games: CardGame[] }) {
  return (
    <section>
      <ShelfHeading title="Indie games to play next" />
      {games.length > 0 && <CardGrid games={games} pageAppid={appId} ranked />}
      {!games.length && <EmptyNote>Recommendations are being prepared for this game. Check back soon.</EmptyNote>}
    </section>
  );
}
