import { getSupabaseServerClient } from "./supabase/server";
import { Suggestion } from "./supabase/types";
import {
  fetchSteamSpyData,
  fetchSteamStoreTags,
  tagsArrayToRecord,
  getTopTags,
  calculateTagSimilarity,
  isAdultContent,
  getContentDescriptorIds,
} from "./utils/steamspy";

export type CategorizedSuggestions = {
  sameDeveloper: Suggestion[];
  niche: Suggestion[];
  popular: Suggestion[];
  all: Suggestion[];
};

type GameWithTags = {
  appid: number;
  title: string;
  steamspy_tags: Record<string, number>;
  steamspy_owners: string | null;
  raw: Record<string, unknown>;
};

function parseOwners(owners: string | null): number {
  if (!owners) return 0;
  const match = owners.match(/^([\d,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

async function fetchGamesByDeveloper(developer: string): Promise<number[]> {
  const url = `https://store.steampowered.com/search/?developer=${encodeURIComponent(developer)}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const html = await res.text();
  const matches = html.match(/data-ds-appid="(\d+)"/g) || [];

  return matches
    .map((m) => parseInt(m.match(/\d+/)?.[0] || "0", 10))
    .filter((id) => id > 0);
}

async function findSameDeveloperGames(
  sourceAppid: number,
  developer: string
): Promise<number[]> {
  if (!developer) return [];

  const devs = developer.split(",").map((d) => d.trim()).filter(Boolean);
  const appIds = new Set<number>();

  for (const dev of devs.slice(0, 2)) {
    const ids = await fetchGamesByDeveloper(dev);
    ids.forEach((id) => appIds.add(id));
  }

  appIds.delete(sourceAppid);
  return Array.from(appIds).slice(0, 10);
}

async function findTagBasedCandidates(
  sourceAppid: number,
  sourceTags: Record<string, number>,
  limit = 30
): Promise<GameWithTags[]> {
  const supabase = getSupabaseServerClient();
  const topTags = getTopTags(sourceTags, 5);

  if (topTags.length === 0) return [];

  const { data, error } = await supabase
    .from("games_new")
    .select("appid, title, steamspy_tags, steamspy_owners, raw")
    .neq("appid", sourceAppid)
    .not("steamspy_tags", "eq", "{}")
    .limit(200);

  if (error || !data) {
    console.error("[SUGGEST-HYBRID] Failed to fetch candidates:", error);
    return [];
  }

  const sourceTagSet = new Set(topTags.map((t) => t.toLowerCase()));
  const scored: Array<{ game: GameWithTags; score: number }> = [];

  for (const game of data) {
    const gameTags = game.steamspy_tags as Record<string, number>;
    if (!gameTags || Object.keys(gameTags).length === 0) continue;

    const gameTopTags = getTopTags(gameTags, 10);
    const shared = gameTopTags.filter((t) => sourceTagSet.has(t.toLowerCase()));
    const score = shared.length / Math.max(sourceTagSet.size, 1);

    if (score >= 0.2) {
      scored.push({ game: game as GameWithTags, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.game);
}

export async function suggestGamesHybrid(
  sourceAppid: number,
  sourceTags?: Record<string, number>,
  sourceDeveloper?: string,
  sourceRaw?: Record<string, unknown>
): Promise<CategorizedSuggestions> {
  const supabase = getSupabaseServerClient();

  let tags = sourceTags;
  let developer = sourceDeveloper;
  let raw = sourceRaw;

  if (!tags || !developer) {
    const steamspyData = await fetchSteamSpyData(sourceAppid);
    if (steamspyData) {
      tags = tags || steamspyData.tags;
      developer = developer || steamspyData.developer;
    }
  }

  if (!tags || Object.keys(tags).length === 0) {
    console.log(`[SUGGEST-HYBRID] No SteamSpy tags for ${sourceAppid}, trying Steam store...`);
    const steamTags = await fetchSteamStoreTags(sourceAppid);
    if (steamTags.length > 0) {
      tags = tagsArrayToRecord(steamTags);
      console.log(`[SUGGEST-HYBRID] Got ${steamTags.length} tags from Steam store`);
    }
  }

  if (!raw) {
    const { data } = await supabase
      .from("games_new")
      .select("raw")
      .eq("appid", sourceAppid)
      .single();
    raw = (data?.raw as Record<string, unknown>) || {};
  }

  const sourceContentIds = getContentDescriptorIds(raw);
  const sourceIsAdult = isAdultContent(sourceContentIds);

  const sameDeveloper: Suggestion[] = [];
  const niche: Suggestion[] = [];
  const popular: Suggestion[] = [];
  const seen = new Set<number>();

  if (developer) {
    const devAppIds = await findSameDeveloperGames(sourceAppid, developer);

    for (const appid of devAppIds) {
      if (seen.has(appid)) continue;

      const { data: gameData } = await supabase
        .from("games_new")
        .select("appid, title, raw")
        .eq("appid", appid)
        .single();

      if (!gameData) continue;

      const gameRaw = (gameData.raw as Record<string, unknown>) || {};
      const gameContentIds = getContentDescriptorIds(gameRaw);
      if (isAdultContent(gameContentIds) && !sourceIsAdult) continue;

      const title = gameData.title || `Game ${appid}`;
      if (title.toLowerCase().includes("soundtrack")) continue;
      if (title.toLowerCase().includes("artbook")) continue;

      seen.add(appid);
      sameDeveloper.push({
        appId: appid,
        title,
        explanation: `From the same developer`,
        category: "same-developer",
      });
    }
  }

  if (tags && Object.keys(tags).length > 0) {
    const candidates = await findTagBasedCandidates(sourceAppid, tags, 30);
    const sourceTopTags = getTopTags(tags, 15);

    for (const candidate of candidates) {
      if (seen.has(candidate.appid)) continue;

      const candidateTags = candidate.steamspy_tags;
      const { score, sharedTags, vibeConflict } = calculateTagSimilarity(tags, candidateTags);

      if (vibeConflict) continue;
      if (score < 0.25) continue;

      const gameRaw = (candidate.raw as Record<string, unknown>) || {};
      const gameContentIds = getContentDescriptorIds(gameRaw);
      if (isAdultContent(gameContentIds) && !sourceIsAdult) continue;

      seen.add(candidate.appid);

      const ownerCount = parseOwners(candidate.steamspy_owners);
      const explanation = `Shares ${sharedTags.slice(0, 3).join(", ")} vibes`;

      if (ownerCount < 200000) {
        niche.push({
          appId: candidate.appid,
          title: candidate.title,
          explanation,
          category: "niche",
        });
      } else {
        popular.push({
          appId: candidate.appid,
          title: candidate.title,
          explanation,
          category: "popular",
        });
      }
    }
  }

  const all = [...sameDeveloper, ...niche, ...popular];

  return { sameDeveloper, niche, popular, all };
}
