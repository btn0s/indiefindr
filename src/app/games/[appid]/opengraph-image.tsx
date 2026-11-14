import { getRecommendations } from "@/lib/catalog";
import { gameGridImage, OG_SIZE } from "@/lib/og-grid";

export const alt = "Indie games like this one, on IndieFindr";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ appid: string }> }) {
  const appId = Number((await params).appid);
  return gameGridImage(Number.isInteger(appId) ? (await getRecommendations(appId)).map(({ game }) => game.header_image) : []);
}
