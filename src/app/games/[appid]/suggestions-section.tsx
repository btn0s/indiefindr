import { ShelfHeading } from "@/components/ShelfHeading";
import type { RecommendationCard } from "@/lib/catalog";
import { GameCard } from "@/components/GameCard";

export function SuggestionsSection({ appId, gameTitle, recs }: { appId: number; gameTitle: string; recs: RecommendationCard[] }) {
  return (
    <section>
      <ShelfHeading title="Indie games to play next" note={`Picked to match ${gameTitle} on gameplay, themes, and feel.`} />
      <div className="game-grid">
        {recs.map(({ game }, index) => (
          <GameCard key={game.appid} {...game} pageAppid={appId} position={index + 1} />
        ))}
      </div>
      {!recs.length && <p className="empty-note">Recommendations are being prepared for this game.</p>}
    </section>
  );
}
