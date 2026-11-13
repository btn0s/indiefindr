import { getGame } from "@/lib/catalog";
import { GameCard, GameCardNotFound } from "./GameCard";

interface GameCardAsyncProps {
  appid: number;
  explanation?: string;
  priority?: boolean;
}

export async function GameCardAsync({
  appid,
  explanation,
  priority = false,
}: GameCardAsyncProps) {
  const game = await getGame(appid);

  if (!game) {
    return <GameCardNotFound explanation={explanation} />;
  }

  return (
    <GameCard
      appid={game.appid}
      title={game.title}
      header_image={game.header_image}
      explanation={explanation}
      priority={priority}
    />
  );
}
