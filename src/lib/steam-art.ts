import { cacheLife } from "next/cache";
import { retry } from "@/lib/utils/retry";

const ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/";

type StoreItem = { id: number; assets?: { asset_url_format?: string; library_capsule?: string } };

export async function getBoxArt(appids: number[]): Promise<Record<number, string>> {
  "use cache";
  cacheLife("days");
  const batches = Array.from({ length: Math.ceil(appids.length / 100) }, (_, index) => appids.slice(index * 100, index * 100 + 100));
  const items = (await Promise.all(batches.map(batch => retry(() => storeItems(batch), { maxAttempts: 2 })))).flat();
  return Object.fromEntries(items.flatMap(({ id, assets = {} }) => {
    const { asset_url_format: format, library_capsule: file } = assets;
    return format && file && !file.endsWith("portrait.png") ? [[id, ASSETS + format.replace("${FILENAME}", file)]] : [];
  }));
}

async function storeItems(appids: number[]): Promise<StoreItem[]> {
  const request = { ids: appids.map(appid => ({ appid })), context: { language: "english", country_code: "US", steam_realm: 1 }, data_request: { include_assets: true } };
  const response = await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(request))}`);
  if (!response.ok) throw Object.assign(new Error(`Steam store items: ${response.status}`), { status: response.status });
  const { response: body } = await response.json() as { response?: { store_items?: StoreItem[] } };
  return body?.store_items ?? [];
}
