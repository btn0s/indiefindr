import { getOrFetchGame } from "@/lib/actions/games";
import { GameCard, GameCardNotFound } from "./GameCard";

interface GameCardAsyncProps {
  appid: number;
  explanation?: string;
}

export async function GameCardAsync({ appid, explanation }: GameCardAsyncProps) {
  const game = await getOrFetchGame(appid);

  if (!game) {
    return <GameCardNotFound explanation={explanation} />;
  }

  return (
    <GameCard
      appid={game.appid}
      title={game.title}
      header_image={game.header_image}
      explanation={explanation}
    />
  );
}
