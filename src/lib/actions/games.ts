"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";


export type GameData = {
  appid: number;
  title: string;
  short_description: string | null;
  videos: string[];
  header_image: string | null;
  developers: string[];
  release_date: string | null;
};

/** Request paths only read the preloaded catalog. */
export async function getOrFetchGame(appId: number): Promise<GameData | null> {
 const { data, error } = await getSupabaseServerClient().from("games")
 .select("appid,title,short_description,header_image,developers,release_date").eq("appid",appId).maybeSingle();
 if(error) throw new Error("Catalog unavailable");
 return data ? {...data, videos: []} : null;
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
    .from("games")
    .select("appid, title, header_image")
    .eq("is_indie", true)
    .order("review_count", { ascending: false })
    .order("appid")
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return [];

  return (data || []).map((g) => ({
    appid: g.appid,
    title: g.title,
    header_image: g.header_image,
  }));
}
