import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGame, getPackSet } from "@/lib/catalog";
import { getBoxArt } from "@/lib/steam-art";
import { deal } from "@/lib/packs";
import { PackOpening } from "@/components/pack/PackOpening";

const SEEDS = [367520, 413150, 2379780, 504230, 1145360];

export function generateStaticParams() {
  return SEEDS.map(appid => ({ appid: String(appid) }));
}

export async function generateMetadata({ params }: { params: Promise<{ appid: string }> }): Promise<Metadata> {
  const game = await getGame(parseInt((await params).appid, 10));
  if (!game) return { title: "Game not found" };
  return { title: `Open a pack of games like ${game.title}`, robots: { index: false } };
}

export default async function PackPage({ params }: { params: Promise<{ appid: string }> }) {
  const appId = parseInt((await params).appid, 10);
  if (isNaN(appId)) notFound();
  const game = await getGame(appId);
  if (!game) notFound();
  const packSet = await getPackSet(appId);
  const dealt = deal(packSet);
  const art = await getBoxArt([appId, ...dealt.flat().map(card => card.appid)]);
  const packs = dealt.map(pack => pack.map(card => ({ ...card, art: art[card.appid] ?? null })));
  return (
    <PackOpening
      seed={{ appid: appId, title: game.title, art: art[appId] ?? null, still: game.screenshots?.[0] ?? game.header_image }}
      packs={packs}
      setSize={packSet.set.length}
      printed={packSet.today}
    />
  );
}
