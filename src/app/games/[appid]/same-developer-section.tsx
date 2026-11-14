import { ShelfHeading } from "@/components/ShelfHeading";
import { CardGrid } from "@/components/CardGrid";
import type { CardGame } from "@/lib/catalog";

export function SameDeveloperSection({ developers, games }: { developers: string[]; games: CardGame[] }) {
  if (!games.length) return null;
  return (
    <section>
      <ShelfHeading title={`More from ${developers.length === 1 ? developers[0] : "these developers"}`}
        href={developers.length === 1 ? `/developer/${encodeURIComponent(developers[0])}` : undefined} />
      <CardGrid games={games} />
    </section>
  );
}
