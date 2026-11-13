import { ShelfHeading } from "@/components/ShelfHeading";
import { getRecommendations } from "@/lib/catalog";
import { GameCard } from "@/components/GameCard";

export async function SuggestionsSection({ appId, gameTitle }: { appId: number; gameTitle: string }) {
  const slate = await getRecommendations(appId);
  return (
    <section>
      <ShelfHeading title="Indie games to play next" note={`Picked to match ${gameTitle} on gameplay, themes, and feel.`} />
      <div className="game-grid">
        {slate.map(({ game, rank }) => (
          <GameCard key={game.appid} {...game} pageAppid={appId} position={rank} />
        ))}
      </div>
      {!slate.length && <p className="empty-note">Recommendations are being prepared for this game.</p>}
    </section>
  );
}
