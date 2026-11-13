import { getRecommendations } from "@/lib/catalog";
import { GameCard } from "@/components/GameCard";

export async function SuggestionsSection({ appId, gameTitle }: { appId: number; gameTitle: string }) {
  const slate = await getRecommendations(appId);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Indie games like {gameTitle}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {slate.map(({ game, rank }) => (
          <GameCard key={game.appid} {...game} pageAppid={appId} position={rank} />
        ))}
      </div>
      {!slate.length && <p>Recommendations are being prepared for this game.</p>}
    </section>
  );
}
