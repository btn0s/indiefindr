import { cacheLife } from "next/cache";
import SteamUser from "steam-user";
import { STEAM_ASSETS } from "@/lib/steam-art";

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
    src: `${STEAM_ASSETS}steam/apps/${appid}/${file}`,
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
