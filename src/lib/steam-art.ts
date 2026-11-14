import { cacheLife } from "next/cache";
import { retry } from "@/lib/utils/retry";

/** Where Steam serves a game's store and library images. */
export const STEAM_ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/";

/** A game's Steam library art: the 600×900 box art (cover) and the wide key art made to sit under its logo (hero). */
export type LibraryArt = { cover: string | null; hero: string | null };

type StoreItem = { id: number; assets?: { asset_url_format?: string; library_capsule?: string; library_hero?: string } };

/** Library art for a list of games, by appid. Neither the catalog nor Steam's appdetails API carries it, and newer
 *  games keep it under hashed paths, so it comes from IStoreBrowseService/GetItems, which lists each game's asset files
 *  and the format their URLs take: a hundred games a request, kept for days. A game with no library art of its own gets
 *  a stand-in Steam generates (portrait.png: the store header over a smear of itself), which counts as none. */
export async function getLibraryArt(appids: number[]): Promise<Record<number, LibraryArt>> {
  "use cache";
  cacheLife("days");
  const batches = Array.from({ length: Math.ceil(appids.length / 100) }, (_, index) => appids.slice(index * 100, index * 100 + 100));
  const items = (await Promise.all(batches.map(batch => retry(() => storeItems(batch), { maxAttempts: 2 })))).flat();
  return Object.fromEntries(items.map(({ id, assets = {} }) => {
    const url = (file?: string) => file && assets.asset_url_format ? STEAM_ASSETS + assets.asset_url_format.replace("${FILENAME}", file) : null;
    const cover = assets.library_capsule?.endsWith("portrait.png") ? null : url(assets.library_capsule);
    return [id, { cover, hero: url(assets.library_hero) }];
  }));
}

async function storeItems(appids: number[]): Promise<StoreItem[]> {
  const request = { ids: appids.map(appid => ({ appid })), context: { language: "english", country_code: "US", steam_realm: 1 }, data_request: { include_assets: true } };
  const response = await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(request))}`);
  if (!response.ok) throw Object.assign(new Error(`Steam store items: ${response.status}`), { status: response.status });
  const { response: body } = await response.json() as { response?: { store_items?: StoreItem[] } };
  return body?.store_items ?? [];
}
