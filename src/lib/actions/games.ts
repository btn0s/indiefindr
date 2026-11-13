"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";


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
