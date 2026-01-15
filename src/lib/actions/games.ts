"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSteamGame } from "@/lib/steam";

export type GameData = {
  appid: number;
  title: string;
  short_description: string | null;
  videos: string[];
  header_image: string | null;
  developers: string[];
  release_date: string | null;
};

function extractFromRaw(raw: unknown): {
  developers: string[];
  release_date: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { developers: [], release_date: null };
  }
  const data = raw as Record<string, unknown>;
  const developers = Array.isArray(data.developers)
    ? (data.developers as string[]).filter((d) => typeof d === "string")
    : [];
  const release_date =
    data.release_date && typeof data.release_date === "object"
      ? (data.release_date as { date?: string }).date || null
      : null;
  return { developers, release_date };
}

/**
 * Get game data from DB, falling back to Steam API if not found.
 * Upserts to DB when fetched from Steam.
 */
export async function getOrFetchGame(appId: number): Promise<GameData | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("games_new")
    .select(
      "appid, title, short_description, videos, header_image, developers, release_date, raw"
    )
    .eq("appid", appId)
    .maybeSingle();

  const hasNoVideos = data && (!data.videos || (Array.isArray(data.videos) && data.videos.length === 0));
  
  if (data?.title && !hasNoVideos) {
    return {
      appid: data.appid,
      title: data.title,
      short_description: data.short_description,
      videos: data.videos ?? [],
      header_image: data.header_image,
      developers: data.developers ?? [],
      release_date: data.release_date,
    };
  }

  try {
    const steamGame = await fetchSteamGame(appId.toString());
    const { developers, release_date } = extractFromRaw(steamGame.raw);

    await supabase.from("games_new").upsert(
      {
        appid: steamGame.appid,
        title: steamGame.title,
        short_description: steamGame.short_description,
        long_description: steamGame.long_description,
        header_image: steamGame.header_image,
        screenshots: steamGame.screenshots,
        videos: steamGame.videos,
        raw: steamGame.raw,
        developers,
        release_date,
      },
      { onConflict: "appid" }
    );

    return {
      appid: steamGame.appid,
      title: steamGame.title,
      short_description: steamGame.short_description,
      videos: steamGame.videos,
      header_image: steamGame.header_image,
      developers,
      release_date,
    };
  } catch {
    return null;
  }
}

const PAGE_SIZE = 24;

export type HomeGame = {
  appid: number;
  title: string;
  header_image: string | null;
};

export async function loadMoreGames(offset: number): Promise<HomeGame[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new_home")
    .select("appid, title, header_image")
    .order("home_bucket", { ascending: true })
    .order("suggestions_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("appid", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return [];

  return (data || []).map((g) => ({
    appid: g.appid,
    title: g.title,
    header_image: g.header_image,
  }));
}
