import { ShelfHeading } from "@/components/ShelfHeading";
import type { RecommendationCard } from "@/lib/catalog";
import { CardGrid } from "@/components/CardGrid";
import { EmptyNote } from "@/components/EmptyNote";

export function SuggestionsSection({ appId, recs }: { appId: number; recs: RecommendationCard[] }) {
  return (
    <section className="suggestions-section">
      <ShelfHeading title="Indie games to play next" />
      {recs.length > 0 && <CardGrid games={recs.map(({ game }) => game)} pageAppid={appId} ranked />}
      {!recs.length && <EmptyNote>Recommendations are being prepared for this game. Check back soon.</EmptyNote>}
    </section>
  );
}
