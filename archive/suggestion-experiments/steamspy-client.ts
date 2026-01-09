const STEAMSPY_API = "https://steamspy.com/api.php";
const STEAM_API = "https://store.steampowered.com/api/appdetails";

let lastSteamSpyRequest = 0;
let lastSteamRequest = 0;
const STEAMSPY_INTERVAL = 1100;
const STEAM_INTERVAL = 2000;

async function rateLimitSteamSpy(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSteamSpyRequest;
  if (elapsed < STEAMSPY_INTERVAL) {
    await new Promise((r) => setTimeout(r, STEAMSPY_INTERVAL - elapsed));
  }
  lastSteamSpyRequest = Date.now();
}

async function rateLimitSteam(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSteamRequest;
  if (elapsed < STEAM_INTERVAL) {
    await new Promise((r) => setTimeout(r, STEAM_INTERVAL - elapsed));
  }
  lastSteamRequest = Date.now();
}

const STEAM_CONTENT_DESCRIPTOR_SEXUAL = 3;
const STEAM_CONTENT_DESCRIPTOR_ADULT_ONLY = 4;

export function isAdultContent(contentDescriptorIds: number[]): boolean {
  return (
    contentDescriptorIds.includes(STEAM_CONTENT_DESCRIPTOR_SEXUAL) ||
    contentDescriptorIds.includes(STEAM_CONTENT_DESCRIPTOR_ADULT_ONLY)
  );
}

export async function fetchSteamContentDescriptors(appid: number): Promise<number[]> {
  await rateLimitSteam();
  
  const url = `${STEAM_API}?appids=${appid}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  
  const data = await res.json();
  const gameData = data?.[appid]?.data;
  if (!gameData) return [];
  
  return gameData?.content_descriptors?.ids ?? [];
}

export type SteamSpyGame = {
  appid: number;
  name: string | null;
  developer: string;
  publisher: string;
  positive: number;
  negative: number;
  owners: string;
  tags: Record<string, number>;
  genre: string;
};

export async function fetchSteamSpyGame(appid: number): Promise<SteamSpyGame | null> {
  await rateLimitSteamSpy();

  const url = `${STEAMSPY_API}?request=appdetails&appid=${appid}`;
  const res = await fetch(url);

  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.appid) return null;

  return {
    appid: data.appid,
    name: data.name || null,
    developer: data.developer || "",
    publisher: data.publisher || "",
    positive: data.positive || 0,
    negative: data.negative || 0,
    owners: data.owners || "",
    tags: data.tags || {},
    genre: data.genre || "",
  };
}

export async function fetchGamesByTag(tag: string, page = 0): Promise<SteamSpyGame[]> {
  await rateLimitSteamSpy();

  const url = `${STEAMSPY_API}?request=tag&tag=${encodeURIComponent(tag)}&page=${page}`;
  const res = await fetch(url);

  if (!res.ok) return [];

  const data = await res.json();
  if (!data || typeof data !== "object") return [];

  return Object.values(data).map((g: any) => ({
    appid: g.appid,
    name: g.name || null,
    developer: g.developer || "",
    publisher: g.publisher || "",
    positive: g.positive || 0,
    negative: g.negative || 0,
    owners: g.owners || "",
    tags: {},
    genre: g.genre || "",
  }));
}

export function getTopTags(tags: Record<string, number>, limit = 10): string[] {
  return Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function calculateTagOverlap(
  sourceTags: Record<string, number>,
  targetTags: Record<string, number>
): { score: number; shared: string[]; sourceTop: string[]; targetTop: string[] } {
  const sourceTop = getTopTags(sourceTags, 15);
  const targetTop = getTopTags(targetTags, 15);

  if (sourceTop.length === 0 || targetTop.length === 0) {
    return { score: 0, shared: [], sourceTop, targetTop };
  }

  const sourceSet = new Set(sourceTop.map((t) => t.toLowerCase()));
  const shared: string[] = [];

  for (const tag of targetTop) {
    if (sourceSet.has(tag.toLowerCase())) {
      shared.push(tag);
    }
  }

  const score = shared.length / Math.min(sourceTop.length, targetTop.length);
  return { score, shared, sourceTop, targetTop };
}

const VIBE_CONFLICTS = [
  [["horror", "psychological horror", "gore", "dark"], ["wholesome", "family friendly", "cute", "relaxing"]],
  [["sexual content", "adult only", "nudity"], ["family friendly", "wholesome", "cute"]],
];

export function hasVibeConflict(sourceTags: string[], targetTags: string[]): boolean {
  const sourceSet = new Set(sourceTags.map((t) => t.toLowerCase()));
  const targetSet = new Set(targetTags.map((t) => t.toLowerCase()));

  for (const [groupA, groupB] of VIBE_CONFLICTS) {
    const sourceHasA = groupA.some((t) => sourceSet.has(t));
    const targetHasB = groupB.some((t) => targetSet.has(t));
    if (sourceHasA && targetHasB) return true;

    const sourceHasB = groupB.some((t) => sourceSet.has(t));
    const targetHasA = groupA.some((t) => targetSet.has(t));
    if (sourceHasB && targetHasA) return true;
  }

  return false;
}

export async function fetchGamesByDeveloper(developer: string): Promise<number[]> {
  const url = `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const html = await res.text();
  const matches = html.match(/data-ds-appid="(\d+)"/g) || [];

  return matches
    .map((m) => parseInt(m.match(/\d+/)?.[0] || "0", 10))
    .filter((id) => id > 0);
}

export async function fetchGamesByPublisher(publisher: string): Promise<number[]> {
  const url = `https://store.steampowered.com/search/?publisher=${encodeURIComponent(publisher)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const html = await res.text();
  const matches = html.match(/data-ds-appid="(\d+)"/g) || [];

  return matches
    .map((m) => parseInt(m.match(/\d+/)?.[0] || "0", 10))
    .filter((id) => id > 0);
}
