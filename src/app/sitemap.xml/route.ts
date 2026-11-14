import { cacheLife } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

/** One sitemap of hand-built pages, then one per 10,000 games. Null when the catalog is unavailable. */
async function sitemapIndex() {
  "use cache";
  cacheLife("hours");
  const { count, error } = await getSupabaseServerClient().from("games").select("*", { count: "exact", head: true });
  if (error) return null;
  const shards = Array.from({ length: Math.ceil((count || 0) / 10000) }, (_, id) => `<sitemap><loc>${SITE}/sitemap/${id}.xml</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE}/sitemap/pages.xml</loc></sitemap>${shards.join("")}</sitemapindex>`;
}

export async function GET() {
  const xml = await sitemapIndex();
  return xml ? new Response(xml, { headers: { "Content-Type": "application/xml" } }) : new Response(null, { status: 503 });
}
