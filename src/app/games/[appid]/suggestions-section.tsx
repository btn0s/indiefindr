import { ShelfHeading } from "@/components/ShelfHeading";
import type { RecommendationCard } from "@/lib/catalog";
import { CardGrid } from "@/components/CardGrid";
import { EmptyNote } from "@/components/EmptyNote";

export function SuggestionsSection({ appId, gameTitle, recs }: { appId: number; gameTitle: string; recs: RecommendationCard[] }) {
  return (
    <section>
      <ShelfHeading title="Indie games to play next" note={`Picked to match ${gameTitle} on gameplay, themes, and feel.`} />
      {recs.length > 0 && <CardGrid games={recs.map(({ game }) => game)} pageAppid={appId} ranked />}
      {!recs.length && <EmptyNote>Recommendations are being prepared for this game. Check back soon.</EmptyNote>}
    </section>
  );
}
