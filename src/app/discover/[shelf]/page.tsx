import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardGrid } from "@/components/CardGrid";
import { getShelf, isShelf, SHELVES } from "@/lib/catalog";

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
    <header className="page-head">
      <h1 className="page-title">{SHELVES[shelf].title}</h1>
      <p className="page-note">{SHELVES[shelf].note}</p>
    </header>
    <CardGrid games={games} eager={8} />
  </main>;
}
