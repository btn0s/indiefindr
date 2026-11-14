import { cacheLife } from "next/cache";
import SteamUser from "steam-user";
import { retry } from "@/lib/utils/retry";

const ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/";

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
    const url = (file?: string) => file && assets.asset_url_format ? ASSETS + assets.asset_url_format.replace("${FILENAME}", file) : null;
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

/** Where the logo sits over the hero, as the game's developer placed it in Steam's library: pinned to an edge or the
 *  centre on each axis, inside a box sized as a share of the hero's width and height. */
export type HeroLogo = { src: string; x: "start" | "center" | "end"; y: "start" | "center" | "end"; width: number; height: number };

type LibraryAssets = {
  library_logo?: {
    image?: Record<string, string>;
    logo_position?: { pinned_position?: string; width_pct?: string; height_pct?: string };
  };
};

/** The game's transparent logo, made to be set over its hero. Steam's store APIs don't list it; the app's PICS record
 *  (what the Steam client reads, open to an anonymous session) has its file and its placement. Kept for days. Throws
 *  when Steam can't be reached, so a miss is never cached. */
export async function getHeroLogo(appid: number): Promise<HeroLogo | null> {
  "use cache";
  cacheLife("days");
  const { apps } = await withSteam(client => client.getProductInfo([appid], [], true));
  const logo = (apps[appid]?.appinfo.common as { library_assets_full?: LibraryAssets } | undefined)?.library_assets_full?.library_logo;
  const file = logo?.image?.english ?? Object.values(logo?.image ?? {})[0];
  if (!file) return null;
  const { pinned_position: pin = "BottomLeft", width_pct, height_pct } = logo?.logo_position ?? {};
  const side = (name: string) => name === "Left" || name === "Upper" ? "start" : name === "Center" ? "center" : "end";
  const [, vertical = "Bottom", horizontal = "Left"] = /^(Upper|Center|Bottom)(Left|Center|Right)$/.exec(pin) ?? [];
  return {
    src: `${ASSETS}steam/apps/${appid}/${file}`,
    x: side(horizontal), y: side(vertical),
    width: Number(width_pct) || 50, height: Number(height_pct) || 50,
  };
}

let session: Promise<SteamUser> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let active = 0;
let failedAt = 0;

/** Runs `lookup` on an anonymous Steam session shared by every render in this server process: logging on takes a second
 *  or two, a lookup a fraction of that. The session closes after a minute with no lookup running. After a failed logon,
 *  lookups fail at once for a minute rather than each waiting out its own. */
async function withSteam<T>(lookup: (client: SteamUser) => Promise<T>): Promise<T> {
  if (Date.now() - failedAt < 60_000) throw new Error("Steam unavailable");
  clearTimeout(idle);
  active++;
  const current = session ??= logOn();
  try {
    const client = await current;
    return await Promise.race([lookup(client), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Steam lookup timed out")), 8000).unref())]);
  } finally {
    if (--active === 0) idle = setTimeout(() => {
      if (session !== current) return;
      session = null;
      void current.then(client => client.logOff(), () => {});
    }, 60_000).unref();
  }
}

function logOn(): Promise<SteamUser> {
  const opened = new Promise<SteamUser>((resolve, reject) => {
    const client = new SteamUser({ autoRelogin: false, enablePicsCache: false, webCompatibilityMode: true });
    const retire = () => { if (session === opened) session = null; };
    const fail = (error: Error) => { retire(); failedAt = Date.now(); client.logOff(); reject(error); };
    const timeout = setTimeout(() => fail(new Error("Steam logon timed out")), 8000).unref();
    client.once("loggedOn", () => { clearTimeout(timeout); resolve(client); });
    // An error after logon (a dropped connection) only retires the session; the next lookup opens a new one.
    client.on("error", fail);
    client.on("disconnected", retire);
    client.logOn({ anonymous: true });
  });
  return opened;
}
