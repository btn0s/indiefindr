import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CachedGameData = {
  appid: number;
  title: string;
  short_description: string | null;
  header_image: string | null;
  developers: string[] | null;
  release_date: string | null;
  videos: string[] | null;
  raw: unknown;
};

export const getGameByAppId = cache(async (appId: number) => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("games_new")
    .select(
      "appid, title, short_description, header_image, developers, release_date, videos, raw"
    )
    .eq("appid", appId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching game:", error);
    return null;
  }

  return data as CachedGameData | null;
});

export const getGameMetadata = cache(async (appId: number) => {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("games_new")
    .select("title, short_description")
    .eq("appid", appId)
    .maybeSingle();

  return data;
});
