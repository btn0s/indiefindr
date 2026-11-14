import { getShelf, isShelf } from "@/lib/catalog";
import { gameGridImage, OG_SIZE } from "@/lib/og-grid";

export const alt = "Indie games on IndieFindr";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  return gameGridImage(isShelf(shelf) ? (await getShelf(shelf, 6)).map(game => game.header_image) : []);
}
