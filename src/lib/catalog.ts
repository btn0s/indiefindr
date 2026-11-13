import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Shared by metadata and page rendering; one lookup per render. */
export const getGame = cache(async (appid: number) => {
  const { data, error } = await getSupabaseServerClient()
    .from("games")
    .select("appid,title,short_description,header_image,developers,release_date")
    .eq("appid", appid)
    .maybeSingle();
  if (error) throw new Error("Catalog unavailable");
  return data;
});

export type RecommendationCard = {
  rank: number;
  source: "llm" | "model";
  game: { appid: number; title: string; header_image: string | null; is_indie: boolean };
};

/** Join cards in the same database read as the saved slate. */
export async function getRecommendations(appid: number): Promise<RecommendationCard[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("game_recs")
    .select("rank,source,game:games!game_recs_rec_appid_fkey!inner(appid,title,header_image,is_indie)")
    .eq("appid", appid)
    .eq("game.is_indie", true)
    .order("rank");
  if (error) throw new Error("Recommendations unavailable");
  const recs = (data ?? []) as unknown as RecommendationCard[];
  const source = recs.some((rec) => rec.source === "llm") ? "llm" : "model";
  return recs.filter((rec) => rec.source === source);
}
