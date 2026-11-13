import { getRecommendations } from "@/lib/catalog";
import { GameCard } from "@/components/GameCard";

export async function SuggestionsSection({ appId, gameTitle }: { appId: number; gameTitle: string }) {
  const slate = await getRecommendations(appId);
  return (
    <section>
      <div className="section-heading"><h2>Indie games like {gameTitle}</h2></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6">
        {slate.map(({ game, rank }) => (
          <GameCard key={game.appid} {...game} pageAppid={appId} position={rank} />
        ))}
      </div>
      {!slate.length && <p>Recommendations are being prepared for this game.</p>}
    </section>
  );
}
