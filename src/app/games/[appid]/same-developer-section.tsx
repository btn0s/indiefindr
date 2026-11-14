import { CardRail } from "@/components/CardRail";
import type { CardGame } from "@/lib/catalog";

export function SameDeveloperSection({ developers, games }: { developers: string[]; games: CardGame[] }) {
  return <CardRail games={games} title={`More from ${developers.length === 1 ? developers[0] : "these developers"}`}
    href={developers.length === 1 ? `/developer/${encodeURIComponent(developers[0])}` : undefined} />;
}
