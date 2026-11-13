import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GameCard } from "@/components/GameCard";
import { getShelf, isShelf, SHELVES } from "@/lib/catalog";

export const revalidate = 3600;
export const generateStaticParams = () => Object.keys(SHELVES).map(shelf => ({ shelf }));

export async function generateMetadata({ params }: { params: Promise<{ shelf: string }> }): Promise<Metadata> {
  const { shelf } = await params;
  if (!isShelf(shelf)) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  return { title: `${SHELVES[shelf].title} indie games`, description: `${SHELVES[shelf].note}.`, alternates: { canonical: `${siteUrl}/discover/${shelf}` } };
}

export default async function ShelfPage({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  if (!isShelf(shelf)) notFound();
  const games = await getShelf(shelf, 96);
  return <main className="discovery-page">
    <h1 className="page-title">{SHELVES[shelf].title}</h1>
    <p className="game-meta mb-8">{SHELVES[shelf].note}</p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6">
      {games.map((game, index) => <GameCard key={game.appid} {...game} priority={index < 8} />)}
    </div>
  </main>;
}
